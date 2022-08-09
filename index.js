const path = require('path')
const http = require('http')
const fs = require('fs')
const express = require('express')
const bodyParser = require('body-parser');
const SpotifyWebApi = require('spotify-web-api-node')
const YoutubeSearchApi=require('youtube-search-api');

const scopes = [
    'ugc-image-upload',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming',
    'app-remote-control',
    'user-read-email',
    'user-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-read-private',
    'playlist-modify-private',
    'user-library-modify',
    'user-library-read',
    'user-top-read',
    'user-read-playback-position',
    'user-read-recently-played',
    'user-follow-read',
    'user-follow-modify'
]

const secrets = JSON.parse(fs.readFileSync("secret.json", "utf8"))
const spotifyApi = new SpotifyWebApi({
    clientId: secrets.clientId,
    clientSecret: secrets.clientSecret,
    redirectUri: secrets.redirectUri
})

const app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.get('/', (req, res) => {
    res.send(`
        <a href="/login">Login with Spotify</a>
    `)
})

app.get('/login', (req, res) => {
    res.redirect(spotifyApi.createAuthorizeURL(scopes))
})

app.get('/callback', (req, res) => {
    const error = req.query.error
    const code = req.query.code
    const state = req.query.state

    if (error) {
        console.error('Callback Error:', error)
        res.send(`Callback Error: ${error}`)
        return
    }

    spotifyApi
        .authorizationCodeGrant(code)
        .then(data => {
            const access_token = data.body['access_token']
            const refresh_token = data.body['refresh_token']
            const expires_in = data.body['expires_in']

            spotifyApi.setAccessToken(access_token)
            spotifyApi.setRefreshToken(refresh_token)

            res.redirect('/main')

            setInterval(async () => {
                const data = await spotifyApi.refreshAccessToken()
                const access_token = data.body['access_token']

                console.log('The access token has been refreshed!')
                console.log('access_token:', access_token)
                spotifyApi.setAccessToken(access_token)
            }, expires_in / 2 * 1000)
        })
        .catch(error => {
            console.error('Error getting Tokens:', error)
            res.send(`Error getting Tokens: ${error}`)
        })
})

app.get('/main', (req, res) => {
    res.send(`
        <form action="/api" method="post">
            <input name="playlistid" type="text" placeholder="Playlist ID" value="2EgO9tI8OUEKIkJeUjFCb0">
            <input type="submit">
        </form>
    `)
})

app.post('/api', (req, res) => {

    spotifyApi.getPlaylistTracks(req.body.playlistid, {
        offset: 1,
        limit: 100,
        fields: 'items'
    }).then((data) => {
        let tracks = []

        for (let track_obj of data.body.items) {
            const track = track_obj.track
            tracks.push(track + ': ' + track.artists[0].name)
        }

        links = []

        tracks.forEach((entry) => {
            YoutubeSearchApi.GetListByKeyword(entry, '', '1')
            .then((ans) => {links.push(ans.items[0].id)})
        })

        setTimeout(() => {
            res.json(links)
        }, 5000)
        
    })
})

const PORT = 3001 || process.env.PORT
app.listen(3001, () => {
    console.log('Running')
})