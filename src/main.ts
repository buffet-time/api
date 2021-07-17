import FileSystem from 'fs/promises'
import { authorize } from './googleApis.js'
import { google as Google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import expressJs from 'express'
import cors from 'cors'

const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'] // If modifying these scopes, delete token.json.
const tokenPath = './src/sheetsToken.json'
const credentialsPath = './src/sheetsCredentials.json'
let authClient: OAuth2Client
try {
	const content = await FileSystem.readFile(credentialsPath, 'utf-8')
	authClient = await authorize({
		credentials: JSON.parse(content),
		scopes,
		tokenPath
	})
} catch (error) {
	throw error('No sheetsCredentials.json, check readme.md')
}

const express = expressJs()
const sheets = Google.sheets({ version: 'v4', auth: authClient })

express.use(cors())
express.listen(3000, () => {
	console.log('Express is running on port 3000.')
})
express.get('/Sheets', async (request, response) => {
	try {
		response.json(
			await getRows(request.query.id as string, request.query.range as string)
		)
	} catch (error) {
		console.log(`Error in get request:\n ${error}`)
	}
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
