import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import * as awsx from '@pulumi/awsx'

const awsConfig = new pulumi.Config('aws')
const provider = new aws.Provider('devdigital', {
    region: awsConfig.get<aws.Region>('region'),
    assumeRole: {
        roleArn: 'arn:aws:iam::291971919224:role/Admin',
    },
})

const bucket = new aws.s3.Bucket(
    'jifs',
    { acl: 'private', forceDestroy: true },
    { provider },
)

const image = awsx.ecr.buildAndPushImage(
    'not-jiff',
    {
        context: './notjif',
    },
    {},
    { provider },
)

const role = new aws.iam.Role(
    'notjiffer',
    {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal(
            aws.iam.Principals.LambdaPrincipal,
        ),
    },
    { provider },
)

new aws.s3.BucketPolicy(
    'notjiffer',
    {
        bucket: bucket.id,
        policy: pulumi
            .all([role.arn, bucket.arn])
            .apply(([roleArn, bucketArn]) =>
                aws.iam.getPolicyDocument(
                    {
                        statements: [
                            {
                                sid: 'AllowNotjiffer',
                                actions: ['s3:*'],
                                principals: [
                                    {
                                        type: 'AWS',
                                        identifiers: [roleArn],
                                    },
                                ],
                                resources: [bucketArn, `${bucketArn}/*`],
                            },
                        ],
                    },
                    { provider },
                ),
            ).json,
    },
    { provider },
)

new aws.iam.RolePolicyAttachment(
    'notjiffer-s3',
    {
        role: role.id,
        policyArn: new aws.iam.Policy(
            'notjiffer-s3',
            {
                policy: pulumi.all([bucket.arn]).apply(([bucketArn]) =>
                    aws.iam.getPolicyDocument(
                        {
                            statements: [
                                {
                                    sid: 'AllowJiff',
                                    actions: ['s3:*'],
                                    resources: [bucketArn, `${bucketArn}/*`],
                                },
                            ],
                        },
                        { provider },
                    ),
                ).json,
            },
            { provider },
        ).arn,
    },
    { provider },
)

new aws.iam.RolePolicyAttachment(
    'notjiffer-lambda',
    {
        role: role.id,
        policyArn: aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole,
    },
    { provider },
)

const uploadHandler = new aws.lambda.Function(
    'not-jiff',
    {
        packageType: 'Image',
        imageUri: image.imageValue,
        role: role.arn,
        timeout: 900,
        memorySize: 8192,
    },
    { provider },
)

bucket.onObjectCreated(
    'convert-to-not-jif',
    uploadHandler,
    { event: '*' },
    { provider },
)

export const bucketName = bucket.id
