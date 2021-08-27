import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import * as awsx from '@pulumi/awsx'

import { ValidateCertificate } from '@wanews/pulumi-certificate-validation'
import { Certificate } from '@pulumi/aws/acm'

const bucket = new aws.s3.Bucket('jifs', { acl: 'private', forceDestroy: true })

new aws.s3.BucketOwnershipControls('jifs', {
    bucket: bucket.id,
    rule: {
        objectOwnership: 'BucketOwnerPreferred',
    },
})

const usEast1 = new aws.Provider('us-east-1', {
    region: 'us-east-1',
})

const image = awsx.ecr.buildAndPushImage('not-jiff', {
    context: './notjif',
})

const role = new aws.iam.Role('notjiffer', {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal(
        aws.iam.Principals.LambdaPrincipal,
    ),
})

const originAccessIdentity = new aws.cloudfront.OriginAccessIdentity(
    'jifferygiff',
    {
        comment: 'an s3 origin access identity for the notjiffs',
    },
)

new aws.s3.BucketPolicy('notjiffer', {
    bucket: bucket.id,
    policy: pulumi
        .all([role.arn, bucket.arn, originAccessIdentity.iamArn])
        .apply(([roleArn, bucketArn, originAccessIdentityIamArn]) =>
            aws.iam.getPolicyDocument({
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
                    {
                        sid: 'AllowCfloudRunt',
                        actions: [
                            's3:GetObject',
                            's3:ListBucket',
                            's3:PutObject',
                        ],
                        resources: [bucketArn, `${bucketArn}/*`],
                        principals: [
                            {
                                type: 'AWS',
                                identifiers: [originAccessIdentityIamArn],
                            },
                        ],
                    },
                ],
            }),
        ).json,
})

new aws.iam.RolePolicyAttachment('notjiffer-s3', {
    role: role.id,
    policyArn: new aws.iam.Policy('notjiffer-s3', {
        policy: pulumi.all([bucket.arn]).apply(([bucketArn]) =>
            aws.iam.getPolicyDocument({
                statements: [
                    {
                        sid: 'AllowJiff',
                        actions: ['s3:*'],
                        resources: [bucketArn, `${bucketArn}/*`],
                    },
                ],
            }),
        ).json,
    }).arn,
})

new aws.iam.RolePolicyAttachment('notjiffer-lambda', {
    role: role.id,
    policyArn: aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole,
})

const uploadHandler = new aws.lambda.Function('not-jiff', {
    packageType: 'Image',
    imageUri: image.imageValue,
    role: role.arn,
    timeout: 24,
    memorySize: 8192,
})

bucket.onObjectCreated('convert-to-not-jif', uploadHandler, { event: '*' })

const cachePolicy = new aws.cloudfront.CachePolicy('jiffery', {
    comment: 'a cache policy for the jiffs',
    defaultTtl: 60 * 60 * 24 * 30,
    maxTtl: 60 * 60 * 24 * 365 * 10,
    minTtl: 0,
    parametersInCacheKeyAndForwardedToOrigin: {
        enableAcceptEncodingBrotli: true,
        enableAcceptEncodingGzip: true,
        cookiesConfig: {
            cookieBehavior: 'none',
        },
        headersConfig: {
            headerBehavior: 'none',
        },
        queryStringsConfig: {
            queryStringBehavior: 'none',
        },
    },
})

const originRequestPolicy = new aws.cloudfront.OriginRequestPolicy('jiffs', {
    comment: 'an origin request policy for the jiffs',
    cookiesConfig: {
        cookieBehavior: 'none',
    },
    headersConfig: {
        headerBehavior: 'none',
    },
    queryStringsConfig: {
        queryStringBehavior: 'none',
    },
})

const cert = new Certificate(
    'dejiffer',
    {
        domainName: 'notjiffer.com',
        subjectAlternativeNames: ['www.notjiffer.com'],
        validationMethod: 'DNS',
    },
    { provider: usEast1 },
)

const zoneId = pulumi.output(
    aws.route53.getZone({ name: 'notjiffer.com' }, { provider: usEast1 }),
).zoneId

const validCertificate = new ValidateCertificate(
    `cert-validation`,
    {
        cert,
        zones: [
            {
                domain: 'notjiffer.com',
                zoneId,
            },
        ],
    },
    { provider: usEast1 },
)

const cdn = new aws.cloudfront.Distribution('jiffer', {
    enabled: true,
    aliases: ['notjiffer.com', 'www.notjiffer.com'],
    priceClass: 'PriceClass_100',
    isIpv6Enabled: true,
    defaultCacheBehavior: {
        allowedMethods: [
            'HEAD',
            'DELETE',
            'POST',
            'GET',
            'OPTIONS',
            'PUT',
            'PATCH',
        ],
        cachedMethods: ['GET', 'HEAD'],
        cachePolicyId: cachePolicy.id,
        originRequestPolicyId: originRequestPolicy.id,
        viewerProtocolPolicy: 'redirect-to-https',
        targetOriginId: 'defaultOrigin',
        compress: true,
    },
    origins: [
        {
            originId: 'defaultOrigin',
            connectionAttempts: 3,
            connectionTimeout: 3,
            s3OriginConfig: {
                originAccessIdentity:
                    originAccessIdentity.cloudfrontAccessIdentityPath,
            },
            domainName: bucket.bucketRegionalDomainName,
        },
    ],
    viewerCertificate: {
        acmCertificateArn: validCertificate.validCertificateArn,
        minimumProtocolVersion: 'TLSv1.2_2021',
        sslSupportMethod: 'sni-only',
    },
    restrictions: {
        geoRestriction: {
            restrictionType: 'none',
        },
    },
})

;['A', 'AAAA'].forEach((type) =>
    ['notjiffer.com', 'www.notjiffer.com'].forEach(
        (name) =>
            new aws.route53.Record(`${name}-${type}`, {
                name,
                zoneId,
                type,
                aliases: [
                    {
                        name: cdn.domainName,
                        zoneId: cdn.hostedZoneId,
                        evaluateTargetHealth: false,
                    },
                ],
            }),
    ),
)

export const bucketName = bucket.id
