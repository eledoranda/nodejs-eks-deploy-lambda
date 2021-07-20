
data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
}

resource "aws_cloudwatch_log_group" "eks_deploy_lambda_log_group" {
  name              = "/aws/lambda/${var.lambda_function_name}"
  retention_in_days = 14
}

resource "aws_iam_policy" "eks_deploy_lambda_policy" {
  name        = "${var.lambda_function_name}-policy"
  path        = "/"
  description = "IAM policy EKS Deploy Lambda"

  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Action" : [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        "Resource" : "${aws_cloudwatch_log_group.eks_deploy_lambda_log_group.arn}:*",
        "Effect" : "Allow"
        }, {
        "Action" : [
          "ec2:DescribeInstances",
          "ec2:CreateNetworkInterface",
          "ec2:AttachNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ],
        "Resource" : "*",
        "Effect" : "Allow"
      },
      {
        "Action" : [
          "eks:DescribeCluster"
        ],
        "Resource" : "arn:aws:eks:${var.region}:${local.account_id}:cluster/${var.cluster_name}",
        "Effect" : "Allow"
      }
    ]
  })

  depends_on = [
    aws_cloudwatch_log_group.eks_deploy_lambda_log_group
  ]
}

resource "aws_iam_role" "eks_deploy_lambda_role" {
  name = "${var.lambda_function_name}-role"

  assume_role_policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Principal" : {
          "Service" : "lambda.amazonaws.com"
        },
        "Action" : "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "eks_deploy_lambda_attachment" {
  role       = aws_iam_role.eks_deploy_lambda_role.name
  policy_arn = aws_iam_policy.eks_deploy_lambda_policy.arn
}

# Security Group
resource "aws_security_group" "allow_tls" {
  name        = "${var.lambda_function_name}-allow-tls"
  description = "Allow TLS inbound traffic"
  vpc_id      = var.vpc_id

  ingress {
    description = "TLS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.sg_ingress_cidr]
  }

  egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  tags = {
    Name = "allow_tls"
  }
}

# Private VPC Lambda
resource "aws_lambda_function" "eks_deploy_lambda" {
  filename         = "${var.lambda_function_name}.zip"
  function_name    = var.lambda_function_name
  role             = aws_iam_role.eks_deploy_lambda_role.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.eks_deploy_lambda.output_base64sha256
  runtime          = "nodejs14.x"
  timeout          = 60
  memory_size      = 256
  vpc_config {
    subnet_ids         = var.subnets_ids
    security_group_ids = [aws_security_group.allow_tls.id]
  }
  environment {
    variables = {
      CLUSTER_NAME  = var.cluster_name
      IAM_AUTH_PATH = var.aws_auth_command
      REGION        = var.region
    }
  }
  depends_on = [
    data.archive_file.eks_deploy_lambda,
    aws_iam_role_policy_attachment.eks_deploy_lambda_attachment,
    aws_cloudwatch_log_group.eks_deploy_lambda_log_group,
    aws_security_group.allow_tls
  ]
}

# Install AWS IAM Authenticator
resource "null_resource" "install_eks_deploy_lambda_dependencies" {
  provisioner "local-exec" {
    command = "../terraform/script/install-dependencies.sh"
    interpreter = [
      "bash"
    ]
    working_dir = "../lambda"
  }
}

data "archive_file" "eks_deploy_lambda" {
  type        = "zip"
  source_dir  = "../lambda"
  output_path = "${var.lambda_function_name}.zip"
   depends_on = [
     null_resource.install_eks_deploy_lambda_dependencies
   ]
}

output "lambda_role_arn" {
  value = aws_iam_role.eks_deploy_lambda_role.arn
}
