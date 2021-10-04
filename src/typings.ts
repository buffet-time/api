import { OctokitResponse } from '@octokit/types'

export enum Release {
	artist,
	name,
	score,
	type,
	year,
	genre,
	comments
}

export type GithubTreeResponse = OctokitResponse<
	{
		sha: string
		url: string
		truncated: boolean
		tree: {
			path?: string | undefined
			mode?: string | undefined
			type?: string | undefined
			sha?: string | undefined
			size?: number | undefined
			url?: string | undefined
		}[]
	},
	200
>
