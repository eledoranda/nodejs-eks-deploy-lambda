# Manage EKS manifest deployment with Lambda
Node.js Lambda function that uses Kubernetes API without hard-coded Token to interact with EKS.

### Description 
The idea behind this repo is to create a Lambda to deploy and manage K8s applications in EKS using an AWS-oriented approach with IAM Role instead of using a K8s hard-coded token or configuration.   
This project uses the Kubernetes Javascript client [@kubernetes/client-node](https://github.com/kubernetes-client/javascript), but this approach is adaptable for other languages supported by the [client](https://github.com/kubernetes-client).

### How it works
This lambda builds the Kubernetes configuration by automatically retrieving info from EKS using AWS API, fetches the K8s token using [aws-iam-authenticator](https://github.com/kubernetes-sigs/aws-iam-authenticator), and creates a K8s client to communicate with the cluster. 
This strategy could be easily integrated into a DevOps internal/external pipeline without providing direct access to the cluster, but just the permission to invoke the lambda or an API.

### Folders
[Code](/code): This is the only code needed to use the K8s' client inside the Lambda.   
The only further steps to make it works are: 
- create a role for the Lambda with the permission to describe the Cluster (eks:DescribeCluster)
- configure the K8s' RBAC for the Lambda role. 
- add the aws-iam-authenticator to the folder. The default folder path is "bin/aws-iam-authenticator but can be overwritten by the env variable IAM_AUTH_PATH. For further details about how to install check: "[Add IAM Authenticator To Lambda](#add-iam-authenticator-to-lambda)".

<br/>

[Full Example](/full-example): This is a complete example, only for learning purposes, that consists of a terraform file that creates a Lambda with the AWS IAM Authenticator  already built-in. This Lambda has two functionality: Apply a manifest or print the node in the specified namespace. This Lambda read the manifest from a folder inside the package, this is a simplified approach that should be avoided in a real project. A solution could be to store the manifest in a git repo or S3 Bucket.

### Authentication 
The project uses [aws-iam-authenticator](https://github.com/kubernetes-sigs/aws-iam-authenticator) to retrieve the token from EKS. At the moment, I haven't found other solutions to easily retrieve the token.  
In order to use IAM Authenticator is necessary to add the executable to the Lambda code. 
The token is automatically retrieved at runtime using the dynamic configuration object create by [getConfigForOptions](/utils/getConfigForOptions) function. This configuration will be added to the K8s client using the [loadFromOptions](/code/index.js#L22) function.

<br/>

In the next paragraph an example about how to add the IAM authenticator

#### Add IAM Authenticator To Lambda

```
# Inside the Lambda repo, create a /bin directory
mkdir bin 

# Go to /bin
cd bin

# Download AWS IAM Authenticator Linux exe
curl -o ./aws-iam-authenticator \ 
https://amazon-eks.s3.us-west-2.amazonaws.com/1.19.6/2021-01-05/bin/linux/amd64/aws-iam-authenticator
/

# Make it executable
chmod +x ./aws-iam-authenticator
```

#### Allow Lambda Role to use K8s API

To let the Lambda use the K8s API is mandatory to bind the specific RBAC permission to the lambda role.  
I suggest checking  this [AWS documentation](https://docs.aws.amazon.com/eks/latest/userguide/add-user-role.html).    
You could also check the [role](/full-example/kubernetes/role.yml) and [role-binding](/full-example/kubernetes/role-binding.yml) samples.  


##### Edit Config Map aws-auth
This is an example of how to link the K8s' RBAC permission to Lambda's role.


```
# Open Config map
kubectl edit -n kube-system configmap/aws-auth

# Add an entry in mapRoles
mapRoles: |
    ...
    - groups:
      - <lambda_k8s_group>
      rolearn: arn:aws:iam::<account_id>:role/<lambda_role>
      username: <lambda_k8s_username>
```

#### Inovke the Lambda

###### Using the CLI
```
aws lambda invoke --function-name <lambda-name> --payload  '{"namespace": <namespace>}' out --log-type Tail --query 'LogResult' --output text |  base64 -di
```

###### Using the AWS Console
```
{
  "namespace": <namespace>
}
```
###### Optional Body params
```
{
  "clusterContext": <context>, 
  "clusterUser": <user>
}
```
### Env Vars
CLUSTER_NAME: Name of the cluster  
REGION: AWS Region of the cluster  
IAM_AUTH_PATH: Local path to the aws-iam-authenticator inside the Lambda package  

### Reference
The idea to use aws-iam-authenticator was inspired by this [repo](https://github.com/weibeld/lambda-eks-example).