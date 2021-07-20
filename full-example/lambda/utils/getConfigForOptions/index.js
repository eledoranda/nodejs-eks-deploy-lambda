function getClusterConfig(arn, certificate, endpoint) {
    return {
        cluster: {
            caData: certificate,
            server: endpoint
        },
        name: arn
    };
};

function getUserConfig(clusterName, clusterUser, region, command) {
    return {
        name: clusterUser,
        user: {
            exec: {
                apiVersion: "client.authentication.k8s.io/v1alpha1",
                args: [
                    "token",
                    "--region",
                    region,
                    "-i",
                    clusterName
                ],
                command
            }
        }
    };
};

function getContextConfig(arn, contextName, clusterUser) {
    return {
        context: {
            cluster: arn,
            user: clusterUser
        },
        name: contextName
    };
};

/**
* Function that returns the configuration of kubernetes
* @param    {String} clusterName    Name of the cluster
* @param    {String} region         Region of the cluster
* @param    {String} certificare    Certificate of the cluster
* @param    {String} contextName    Context name
* @param    {String} clusterUser    Cluster User
* @param    {String} enpoint        Endpoint of the cluster
* @param    {String} kind           Type of the cluster config
* @param    {String} command        Path to the aws-iam-authenticator executable inside the lambda
* @return   {Object}                kube.config JS object
*/

module.exports = (clusterName, region, arn, contextName, clusterUser, certificate, endpoint, kind, command) => {
    const cluster = getClusterConfig(arn, certificate, endpoint);
    const user = getUserConfig(clusterName, clusterUser, region, command);
    const context = getContextConfig(arn, contextName, clusterUser);
    return {
        clusters: [cluster],
        contexts: [context],
        currentContext: contextName,
        kind: kind,
        preferences: {},
        users: [user]
    };
};