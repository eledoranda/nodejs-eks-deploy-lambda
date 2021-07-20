const fs = require('fs');
const yaml = require('js-yaml');
const k8s = require('@kubernetes/client-node');
const { EKSClient, DescribeClusterCommand } = require("@aws-sdk/client-eks");

const getConfigForOptions = require('./utils/getConfigForOptions');

// Set Env, they are configured in the terraform file
const CLUSTER_NAME = process.env.CLUSTER_NAME;
const REGION = process.env.REGION;
const IAM_AUTH_PATH = process.env.IAM_AUTH_PATH || "./bin/aws-iam-authenticator";


// Config EKS Client
const clientEKS = new EKSClient({ region: REGION });
const kc = new k8s.KubeConfig();

/**
* Lambda Handler, this will apply all the resources defined in the file
* @param    {String} event.namespace    Namespace of the cluster, used for listing pods if create!=yes.
* @param    {String} event.file         Manifest File name of a yaml inside ms/ folder. This is a simplified choice, just for demo pourpose
* @param    {String} event.create       Commands the apply of the file, if equals to 'yes', this function will apply the resources in the manifest
* @return   {Object}                    If create=yes returns a deployment summary otherwise a pods list for the specific namespace
**/

exports.handler = async function (event, context) {

    // Get values from payload
    const { namespace, file, create,  clusterContext, clusterUser } = event;

    try {

        // Get Cluster Info using EKS DescribeCluster API 
        const describeParams = {
            name: CLUSTER_NAME
        };
        const clusterInfo = await clientEKS.send(new DescribeClusterCommand(describeParams));
        const { arn, certificateAuthority, endpoint } = clusterInfo.cluster;

        // By default uses arn
        const cName = clusterContext || arn;
        const cUser = clusterUser || arn;

        // Configure the k8s client using a Config Object, it will use the 'token' command of aws-iam-authenticator to retrieve the EKS token.
        const optionsConfig = getConfigForOptions(CLUSTER_NAME, REGION, arn, cName, cUser, certificateAuthority.data, endpoint, "Config", IAM_AUTH_PATH)
        kc.loadFromOptions(optionsConfig);
        const client = k8s.KubernetesObjectApi.makeApiClient(kc);

        if (create === 'yes') {
            /**
            * Apply all the resources defined in the file 
            * In oreder to create resource, the payload should contains "create=yes"
            **/

            //Object to track all the modifies that would be printed at the end
            const deploymentSummary = {
                created: [],
                patched: [],
                error: []
            }

            const jsonManifests = yaml.loadAll(fs.readFileSync(`ms/${file}.yml`, 'utf8'));
            const validManifests = jsonManifests.filter((m) => m && m.kind && m.metadata);

            for (const resource of validManifests) {
                const name = resource.metadata.name
                const kind = resource.kind
                const ns = resource.metadata.namespace
                try {
                    // Check if resource exists, if so, patch It
                    await client.read(resource);
                    console.log(`Resource '${name}' of type ${kind} already exists in Namespace '${ns}', patching it..`)
                    await client.patch(resource);
                    deploymentSummary.patched.push({ name: name, file: `${file}.yml`, kind });

                } catch (err) {
                    try {
                        // Resource dosen't exist, create it 
                        if (err.statusCode === 404) {

                            console.log(`Resource '${name}' of type ${kind} not found in Namespace '${ns}', creating...`)
                            await client.create(resource);
                            console.log(`Resource '${name}' of type ${kind} created in Namespace '${ns}'`)
                            deploymentSummary.created.push({ name: name, file: `${file}.yml`, kind });

                        }
                        else {
                            console.error(err)
                            deploymentSummary.error.push({ name: name, file: `${file}.yml`, kind, error: `${err.response.body.message}: ${err.statusCode}` });
                        }
                    } catch (err) {
                        console.error(err)
                        deploymentSummary.error.push({ name: name, file: `${file}.yml`, kind, error: `${err.response.body.message}: ${err.statusCode}` });
                    }
                }
            }
            console.log(`Summary: ${JSON.stringify(deploymentSummary, null, 4)}`)
            return deploymentSummary
        }
        else {
            /**
            * Print all the pod in the specific namespace 
            **/

            // Object that will contain pods list
            const podSummary = { namespace }
            const k8sApiCore = kc.makeApiClient(k8s.CoreV1Api);

            // List and Print Pod in the Namespace
            const readPods = await k8sApiCore.listNamespacedPod(namespace)
            const pods = readPods.body.items
            podsList = pods.map(pod => pod.metadata.name)

            if (pods.length < 1) {
                console.log('No Pods Found')
            }
            else {
                console.log(`Pods in Namespace '${namespace}': ${podsList.join(', ')}`)
            }

            podSummary.pods = podsList
            return podSummary
        }
    } catch (err) {
        console.error(err)
        throw new Error(`Error During EKS Lambda Execution: ${err}`)
    }
}