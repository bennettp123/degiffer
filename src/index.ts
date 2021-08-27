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

// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.Bucket(
    'my-bucket',
    {
        acl: 'private',
    },
    {
        provider,
    },
)

const uploadHandler: aws.s3.BucketEventHandler = (event) => {
    const records = event.Records ?? []
    for (const record of records) {
        console.debug(record)
    }
}

bucket.onObjectCreated(
    'convert-to-not-jif',
    uploadHandler,
    { event: '*' },
    { provider },
)

// Export the name of the bucket
export const bucketName = bucket.id
