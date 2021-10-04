import { google as Google } from 'googleapis'
import expressJs from 'express'
import cors from 'cors'
import { GithubTreeResponse, Release } from './typings.js'
import { gmailAuthClient, sheetsAuthClient } from './googleApis.js'
import { redditCredentials, githubToken } from './credentials/credentials.js'
import snoowrap from 'snoowrap'
import { request as githubRequest } from '@octokit/request'

const express = expressJs()
const sheets = Google.sheets({ version: 'v4', auth: sheetsAuthClient })
const reddit = new snoowrap(redditCredentials)

express.listen(3000, () => console.log('Express is running on port 3000.'))

express.get('/Sheets', cors() as any, async (request, response) => {
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
		console.log(`Error in /Sheets request:\n ${error}`)
	}
})

express.get('/Email', async (request, response) => {
	try {
		const to = request.query.to as string,
			subject = request.query.subject as string,
			message = request.query.message as string

		response.json(sendEmail(to, subject, message))
	} catch (error) {
		console.log(`Error in /Email request:\n ${error}`)
	}
})

express.get('/Reddit/Top/Femboy', async (_request, response) => {
	try {
		const redditResponse = await reddit
			.getSubreddit('femboy')
			.getHot({ limit: 1 })
		const topPost = redditResponse.filter((post) => post.archived === false)
		response.json(topPost[0].url)
	} catch (error) {
		console.log(`Error in /Reddit/Top/Femboy request:\n ${error}`)
	}
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
express.get('/Github', async (_request, response) => {
	const pathArray = await getPaths(
		'3640b37b4e69e3acd25eeb4b1d756e06a67bb6a9',
		'https://github.com/buffet-time/testMusicFolder/blob/main'
	)
	if (pathArray) {
		response.json(pathArray)
	} else {
		response.json(['Error'])
	}
})

async function getPaths(
	treeSha: string,
	directory: string
): Promise<string[] | null> {
	const pathArray: string[] = []
	const treeResponse = await getTree(treeSha)
	if (!treeResponse) {
		return null
	}

	for (let x = 0; x < treeResponse.data.tree.length; x++) {
		const tree = treeResponse.data.tree[x]
		if (tree.type === 'tree' && tree.sha && tree.path) {
			const returnedPathArray = await getPaths(tree.sha, tree.path)

			if (returnedPathArray) {
				returnedPathArray.forEach((path) => {
					pathArray.push(`${directory}/${path}`)
				})
			}
		} else if (tree.type === 'blob') {
			if (tree.path) {
				pathArray.push(`${directory}/${tree.path}?raw=true`)
			}
		}
	}

	return pathArray
}

async function getTree(treeSha: string): Promise<GithubTreeResponse | null> {
	try {
		return await githubRequest(
			'GET /repos/{owner}/{repo}/git/trees/{tree_sha}',
			{
				headers: {
					authorization: githubToken
				},
				owner: 'buffet-time',
				repo: 'testMusicFolder',
				tree_sha: treeSha
			}
		)
	} catch (error: any) {
		console.log(`Error in /Github request:\n ${error}`)
		return null
	}
}

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

function sendEmail(to: string, subject: string, message: string) {
	try {
		Google.gmail({ version: 'v1', auth: gmailAuthClient }).users.messages.send({
			auth: gmailAuthClient,
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
