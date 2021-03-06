'use strict'
const { execSync } = require('child_process')

function run(command, { timeout }) {
    console.log(command)
    const result = execSync(command, {
        stdio: 'inherit',
        timeout: (timeout ?? 4) * 1000,
    })
    if (result != null) {
        console.log(result.toString())
    }
}

exports.handler = async (event) => {
    console.log('notjiffer handler called')

    if (!event?.Records) {
        return
    }

    for (const record of event.Records) {
        const filePath = record.s3.object.key
        const bucketName = record.s3.bucket.name

        const inputObject = `s3://${bucketName}/${filePath}`
        const outputObject = `${inputObject}.webp`
        const tempFile = `/tmp/${filePath.replace('/', '_')}`
        const outputFile = `${tempFile}.webp`

        const uploadArgs =
            '--content-type "image/webp" --cache-control "public,must-revalidate"'

        if (inputObject?.endsWith('.webp')) {
            console.error('file is already a webp, ignoring', { inputObject })
            return
        }

        try {
            run(`aws s3 cp "${inputObject}" "${tempFile}"`, { timeout: 4 })
            run(
                `ffmpeg -i "${tempFile}" -vcodec webp -loop 0 -pix_fmt yuv420p "${outputFile}"`,
                { timeout: 12 },
            )
            run(`aws s3 cp "${outputFile}" "${outputObject}" ${uploadArgs}`, {
                timeout: 4,
            })
            run(`rm -f "${tempFile}" "${outputFile}"`, { timeout: 1 })
        } catch (err) {
            console.error('non-zero exit code!', { command, err })
            throw err
        }
        console.log('Created notgif!', { inputObject, outputObject })
    }
}
