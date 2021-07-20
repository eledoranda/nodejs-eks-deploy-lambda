# Manage EKS manifest deployment with Lambda: Code Lambda
Lambda sample to list the pods in a namespace.

## Description
This Lambda retrieves the cluster's configuration and uses [aws-iam-authenticator](https://github.com/kubernetes-sigs/aws-iam-authenticator) to retrieve the Kubernetes token.
After that, returns a list of the pod in the specified namespace 

## Setup Steps
- create a role for the lambda with the permission to describe the Cluster (eks:DescribeCluster)
- configure the K8s' RBAC for the Lambda role. 
- add the aws-iam-authenticator to the folder. The default folder path is "bin/aws-iam-authenticator but can be overwritten by the env variable IAM_AUTH_PATH. 

For more details, check the main [Readme](/README.md)

## Invocation Params

##### Mandatory
namespace: Namespace of the pods to be listed. 
##### Optional
clusterContext: Cluster Contexrt  
clusterUser: Cluster User

## Env Vars
CLUSTER_NAME: Name of the cluster  
REGION: AWS Region of the cluster  
IAM_AUTH_PATH: Local path to the aws-iam-authenticator inside the lambda package