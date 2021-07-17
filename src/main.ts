import FileSystem from 'fs/promises'
import { authorize } from './googleApis.js'
import { google as Google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import expressJs from 'express'
import cors from 'cors'
import { Release } from './typings.js'

let sheetsAuthClient: OAuth2Client
let gmailAuthClient: OAuth2Client
const sheetsTokenPath = './src/credentials/sheetsToken.json'
const gmailTokenPath = './src/credentials/emailToken.json'
const sheetsCredentialsPath = './src/credentials/sheetsCredentials.json'
const gmailCredentialsPath = './src/credentials/emailCredentials.json'
const sheetsScopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'] // If modifying these scopes, delete token.json.
const gmailScopes = ['https://www.googleapis.com/auth/gmail.send']

try {
	const content = await FileSystem.readFile(sheetsCredentialsPath, 'utf-8')
	sheetsAuthClient = await authorize({
		credentials: JSON.parse(content),
		scopes: sheetsScopes,
		tokenPath: sheetsTokenPath
	})
} catch (error) {
	throw error('No sheetsCredentials.json, check readme.md')
}

try {
	const content = await FileSystem.readFile(gmailCredentialsPath, 'utf-8')
	gmailAuthClient = await authorize({
		credentials: JSON.parse(content),
		scopes: gmailScopes,
		tokenPath: gmailTokenPath
	})
} catch (error) {
	throw error('No emailCredentials.json, check readme.md')
}

const express = expressJs()
const sheets = Google.sheets({ version: 'v4', auth: sheetsAuthClient })

express.use(cors())
express.listen(3000, () => {
	console.log('Express is running on port 3000.')
})

express.get('/Sheets', async (request, response) => {
	try {
		const id = request.query.id as string,
			range = request.query.range as string,
			index = Number(request.query.index as string),
			rows = request.query.rows as string
		if (rows === 'true') {
			response.json(await getNumberOfRows(id, range))
		} else if (index) {
			response.json(await getRows(id, range, index))
		} else {
			response.json(await getRows(id, range))
		}
	} catch (error) {
		console.log(`Error in get request:\n ${error}`)
	}
})

express.get('/Email', async (request, response) => {
	const to = request.query.to as string,
		subject = request.query.subject as string,
		message = request.query.message as string

	response.json(sendEmail(to, subject, message, gmailAuthClient))
})

async function getRows(
	spreadsheetId: string,
	range: string,
	index?: number
): Promise<string[][]> {
	return new Promise((resolve) => {
		sheets.spreadsheets.values.get(
			{
				spreadsheetId: spreadsheetId,
				range: range
			},
			(error, response) => {
				if (error) {
					console.log(`Error in getRows():\n ${error}`)
				} else {
					if (index && response && response.data.values) {
						resolve(response.data.values[index])
					} else if (response && response.data.values) {
						resolve(response.data.values)
					}
				}
				resolve([])
			}
		)
	})
}

async function getNumberOfRows(
	spreadsheetId: string,
	range: string
): Promise<number> {
	return new Promise((resolve) => {
		sheets.spreadsheets.values.get(
			{
				spreadsheetId: spreadsheetId,
				range: range
			},
			(_err, res) => {
				if (res && res.data.values) {
					const sheetsArray = res.data.values

					let n = sheetsArray.length - 1
					while (n > 0) {
						const row = sheetsArray[n]
						if (rowIsFilledOut(row)) {
							resolve(n + 1)
						}
						n--
					}
				} else {
					console.log('Res or Res Values was undefined in getNumberOfRows.')
				}
			}
		)
	})
}

function rowIsFilledOut(row: string[]): boolean {
	if (
		row[Release.score] &&
		row[Release.comments] &&
		row[Release.artist] &&
		row[Release.name] &&
		row[Release.type] &&
		row[Release.year] &&
		row[Release.genre]
	) {
		return true
	} else {
		return false
	}
}

function sendEmail(
	to: string,
	subject: string,
	message: string,
	auth: OAuth2Client
) {
	try {
		Google.gmail({ version: 'v1', auth }).users.messages.send({
			auth: auth,
			userId: 'buffetsbot@gmail.com',
			requestBody: {
				raw: makeBody(to, 'buffetsbot@gmail.com', subject, message)
			}
		})
		return 'good'
	} catch (error) {
		return 'error'
	}
}

function makeBody(to: string, from: string, subject: string, message: string) {
	const stringArray = [
		'Content-Type: text/plain; charset="UTF-8"\n',
		'MIME-Version: 1.0\n',
		'Content-Transfer-Encoding: 7bit\n',
		'to: ',
		to,
		'\n',
		'from: ',
		from,
		'\n',
		'subject: ',
		subject,
		'\n\n',
		message
	].join('')

	const returnString = Buffer.from(stringArray)
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')

	return returnString
}
