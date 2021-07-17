/* eslint-disable @typescript-eslint/no-explicit-any */
import { OAuth2Client } from 'google-auth-library'
import { google as Google } from 'googleapis'
import { default as Readline } from 'readline'
import FileSystem from 'fs/promises'

// Create an OAuth2 client with the given credentials
export async function authorize({
	credentials,
	scopes,
	tokenPath
}: {
	credentials: any
	scopes: string[]
	tokenPath: string
}): Promise<OAuth2Client> {
	const { client_secret, client_id, redirect_uris } = credentials.installed
	const oAuth2Client = new Google.auth.OAuth2(
		client_id,
		client_secret,
		redirect_uris[0]
	)

	// Check if we have previously stored a token.
	try {
		const token = await FileSystem.readFile(tokenPath, 'utf-8')
		oAuth2Client.setCredentials(JSON.parse(token))
	} catch (error) {
		await getNewToken(oAuth2Client, scopes, tokenPath)
	}
	return oAuth2Client
}

// Get and store new token after prompting for user authorization
function getNewToken(
	oAuth2Client: OAuth2Client,
	scopes: any,
	tokenPath: any
): Promise<void> {
	const authUrl = oAuth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: scopes
	})
	console.log('Authorize this app by visiting this url:', authUrl)
	const readline = Readline.createInterface({
		input: process.stdin as any,
		output: process.stdout as any
	})
	return new Promise((resolve) =>
		readline.question('Enter the code from that page here: ', (code) => {
			readline.close()
			resolve(
				new Promise((resolve) =>
					oAuth2Client.getToken(code, async (err, token) => {
						if (err || !token) {
							return console.error('Error retrieving access token', err)
						}
						oAuth2Client.setCredentials(token)
						try {
							await FileSystem.writeFile(
								tokenPath,
								JSON.stringify(token, null, 2)
							)
						} catch (error) {
							// console.log(error)
						}
						resolve()
					})
				)
			)
		})
	)
}
