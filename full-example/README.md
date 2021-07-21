# Manage EKS manifest deployment with Lambda: Terraform Sample
The following example is a simplified use case, for learning purposes, to deploy a lambda that could be used to Apply Kubernetes manifests without requiring a hard-coded token or configuration.

# Description
This lambda is deployed with a IAM role to describe the EKS cluster and with the [aws-iam-authenticator](https://github.com/kubernetes-sigs/aws-iam-authenticator) built-in to retrieve the cluster token.
In this demo, is possible to call the lambda to apply a manifest or to list the pods in the specified namespace. 
This code is specific for deploying in a single cluster but could also be easily re-arranged for cross-cluster deployment, even if I would not recommend it.

# Action

### Apply Manifest
To apply a manifest, it's necessary to call the lambda with the parameter "create=yes" and the file name related to the manifest.
The Lamba will check if the resources inside the manifest exit; if so, it will patch them otherwise it will create them.
To simplify the demo, this lambda contains a deployment manifest inside this [folder](/full-example/lambda/ms); in a real use-case this manifest should be kept outside the lambda in different storage and access to the Lambda.

##### Inovke Lambda: Apply Manifest

###### CLI

```
# Invoke the Lambda to create the deployment
aws lambda invoke --function-name eks-deploy-lambda --payload  '{"file": "nginx-deployment", "create": "yes"}' out --log-type Tail --query 'LogResult' --output text |  base64 -di
```
###### AWS Console

```
{
  "file": "nginx-deployment", 
  "create": "yes"
}
```
###### Optional Body params
```
{
  "clusterContext": <context>, 
  "clusterUser": <user>
}
```

### List Pods in Namespace
To list the pods in the specfic namespace is necessary to pass the "namespace" property in the body.

##### Invoke Lambda: List Pods

###### CLI
```
# Invoke the Lambda to list the pods
aws lambda invoke --function-name eks-deploy-lambda --payload  '{"namespace": "test-eks-lambda"}' out --log-type Tail --query 'LogResult' --output text |  base64 -di
```
###### AWS Console

```
{
  "namespace": "test-eks-lambda" 
}
```
###### Optional Body params
```
{
  "clusterContext": <context>, 
  "clusterUser": <user>
}
```
# Setup Steps

## Terraform

### Deploy Lambda
```
# Go to the terraform folder
cd full-example/terraform

terraform init

# Apply the modifies. The vars vpc_id,subent_ids and region are mandatory. It's possible to copy the lambda_role_arn from the output; the arn is necessary for the last step.
terraform apply -var='subnets_ids=["<private_subnet_1>","private_subnet_2"]' -var="vpc_id=<vpc_id>" -var="region=<aws_region>"
```
## Kubernetes

### Kuberentes Role

Create the namespace and the role for the demo.

```
# Go to the manifests folder
cd full-example/kubernetes

# Create Namespace
kubectl apply -f namespace.yml

# Create Role
kubectl apply -f role.yml

# Create Role Binding
kubectl apply -f role-binding.yml
```

### Edit Config Map aws-auth

Edit the Config Map to bind the IAM Role of the Lambda to the role in K8s.

```
# Open Config map
kubectl edit -n kube-system configmap/aws-auth

# Add an entry in mapRoles. You could use the lambda_role_arn returned by terraform.
mapRoles: |
    ...
    - groups:
      - eks-lambda
      rolearn: arn:aws:iam::<account_id>:role/<lambda_role>
      username:  eks-lambda
```
# Default Configuration Terraform
IAM_AUTH_PATH=./bin/aws-iam-authenticator (if you change this, is necessary also to edit the [install-dependencies.sh](/full-example/terraform/script/install-dependencies.sh) accordingly.)  
CLUSTER_NAME=sample-test-cluster