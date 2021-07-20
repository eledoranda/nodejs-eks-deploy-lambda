#!/bin/bash
npm ci 
mkdir -p bin && cd bin
result=$(curl -o ./aws-iam-authenticator -s -w "%{http_code}\n" https://amazon-eks.s3.us-west-2.amazonaws.com/1.19.6/2021-01-05/bin/linux/amd64/aws-iam-authenticator)
echo Get aws-iam-authenticator Status Code $result
if [ "$result" -eq 200 ]
then
   chmod +x ./aws-iam-authenticator && exit 0
else
  echo GET aws-iam-authenticator returned status code: $result &&  exit 1
fi