import { OAuth2Client } from 'google-auth-library'
import { google as Google } from 'googleapis'
import { default as Readline } from 'readline'
import FileSystem from 'fs/promises'

let sheetsAuthClient: OAuth2Client
try {
	const sheetsCredentialsPath = './src/credentials/sheetsCredentials.json'
	const sheetsScopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'] // If modifying these scopes, delete token.json.
	const sheetsTokenPath = './src/credentials/sheetsToken.json'
	const content = await FileSystem.readFile(sheetsCredentialsPath, 'utf-8')
	sheetsAuthClient = await authorize({
		credentials: JSON.parse(content),
		scopes: sheetsScopes,
		tokenPath: sheetsTokenPath
	})
} catch (error) {
	throw new Error('No sheetsCredentials.json, check readme.md')
}

let gmailAuthClient: OAuth2Client
try {
	const gmailCredentialsPath = './src/credentials/emailCredentials.json'
	const gmailTokenPath = './src/credentials/emailToken.json'
	const gmailScopes = ['https://www.googleapis.com/auth/gmail.send']
	const content = await FileSystem.readFile(gmailCredentialsPath, 'utf-8')
	gmailAuthClient = await authorize({
		credentials: JSON.parse(content),
		scopes: gmailScopes,
		tokenPath: gmailTokenPath
	})
} catch (error) {
	throw new Error('No emailCredentials.json, check readme.md')
}

export { sheetsAuthClient, gmailAuthClient }

// Create an OAuth2 client with the given credentials
async function authorize({
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
