variable "region"{
}
variable "vpc_id"{
}

variable "subnets_ids"{
    type = set(string)
}

variable "sg_ingress_cidr"{
    default = "0.0.0.0/0"
}

variable "lambda_function_name" {
  default = "eks-deploy-lambda"
}

variable "cluster_name"{
    default = "sample-test-cluster"
}

variable "aws_auth_command"{
    default = "./bin/aws-iam-authenticator"
}


