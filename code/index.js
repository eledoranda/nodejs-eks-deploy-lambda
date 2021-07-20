const k8s = require('@kubernetes/client-node');
const { EKSClient, DescribeClusterCommand } = require("@aws-sdk/client-eks");
const getConfigForOptions = require('./utils/getConfigForOptions');

// Set Env
const CLUSTER_NAME = process.env.CLUSTER_NAME;
const REGION = process.env.REGION;
const IAM_AUTH_PATH = process.env.IAM_AUTH_PATH || "./bin/aws-iam-authenticator"; 

// Create EKS Client
const clientEKS = new EKSClient({ region: REGION });
const kc = new k8s.KubeConfig()


/**
* Lambda Handler, it lists the pods in the namespace
* @param    {String} event.namespace    Namespace of the cluster
* @return   {Object}                    Pods' list for the specific namespace
**/
exports.handler = async function (event) {

    // Get Namespace from payload
    const { namespace, clusterContext, clusterUser } = event;

    try {
        // Get Cluster Info using EKS DescribeCluster API 
        const describeParams = {
            name: CLUSTER_NAME
        };
        const clusterInfo = await clientEKS.send(new DescribeClusterCommand(describeParams));
        const { arn, certificateAuthority, endpoint } = clusterInfo.cluster;
        
        // By default uses arn
        const cName = clusterContext || arn;
        const cUser = clusterUser  || arn;

        // Configure the k8s client using a Config Object, it will use the 'token' command of aws-iam-authenticator to retrieve the EKS token.
        const optionsConfig = getConfigForOptions(CLUSTER_NAME, REGION, arn, cName, cUser, certificateAuthority.data, endpoint, "Config", IAM_AUTH_PATH)

        kc.loadFromOptions(optionsConfig);
        const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

        // List and Print Pod in the Namespace
        const response = await k8sApi.listNamespacedPod(namespace);
        const pods = response.body.items;
        const podsList = pods.map(pod => pod.metadata.name)

        console.log(`Pods in ${namespace}: ${podsList.join(', ')}`);

        return {
            namespace,
            pods: podsList
        }

    } catch (err) {
        console.error(err)
        throw new Error(`Error During listNamespacedPod call: ${err}`);
    }
}