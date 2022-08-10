const path = require('path')
const http = require('http')
const fs = require('fs')
const express = require('express')
const bodyParser = require('body-parser')
const SpotifyWebApi = require('spotify-web-api-node')
const youtubeApi = require('youtube-search-without-api-key')
const readline = require('readline')
const ytdl = require('ytdl-core')
const ffmpeg = require('fluent-ffmpeg')

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

const config = JSON.parse(fs.readFileSync("config.json", "utf8"))
const spotifyApi = new SpotifyWebApi({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri
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
            <input name="playlistid" type="text" placeholder="Playlist ID" value="3NEKLoQGcF4ltWSW9fDaAw">
            <input type="submit">
        </form>
    `)
})

app.get("/music/:file", (req, res) => {
    res.download(
        path.join(__dirname, "music/" + req.params.file),
        (err) => {
            if (err) res.status(404).send("<pre>404</pre>")
        }
    )
})

app.post('/api', (req, res) => {

    getAllSongs(req.body.playlistid)
    .then((data) => {

        // process tracks: spotify api -> filtered song & artist
        let tracks = []

        data.forEach((track) => {
            tracks.push(track.track.name + ' - ' + track.track.artists[0].name)
        })

        // get youtube link: filtered song & artist -> youtube api
        let track_ids = []
        let unfound = []

        tracks.forEach((song) => {
            youtubeApi.search(song + 'audio')
            .then((res) => {
                if (res.length != 0) {
                    track_ids.push({"name": song, "id": res[0].id.videoId})
                } else {
                    unfound.push(song)
                }
            })
        })

        const track_ids_check = () => {
            if (track_ids.length != tracks.length - unfound.length) {
                console.log(track_ids.length)
                setTimeout(track_ids_check, 200)
            } else {
                console.log(track_ids.length)
                unfound.length == 0 ? null : console.log(unfound)

                // youtube api data -> get video -> ffmpeg to mp3 -> get link
                let mp3_links = []

                if (!fs.existsSync('music')) {
                    fs.mkdirSync("music");
                }

                track_ids.forEach((song) => {

                    let stream = ytdl(song.id, {
                        quality: 'highestaudio'
                    })

                    ffmpeg(stream)
                    .audioBitrate(128)
                    .save(`music/${song.name}.mp3`)
                    .on('end', () => {
                        mp3_links.push(`http://${req.headers.host}/music/${song.name}.mp3`)
                    })
                })

                const mp3_links_check = () => {
                    if (mp3_links.length != tracks.length - unfound.length) {
                        console.log(mp3_links.length)
                        setTimeout(mp3_links_check, 500)
                    } else {
                        res.json(mp3_links)
                    }
                }

                mp3_links_check()
            }
        }

        track_ids_check()
    })
})

async function getAllSongs(id) {
    var data = await spotifyApi.getPlaylistTracks(id);
    var numBatches = Math.floor(data.body.total / 100) + 1
    var promises = []
    for (let batchNum = 0; batchNum < numBatches; batchNum++) {
        var promise = getSongs(id, batchNum * 100)
        promises.push(promise)
    }
    var rawSongData = await Promise.all(promises)
    var songs = []
    for (let i = 0; i < rawSongData.length; i++) {
        songs = songs.concat(rawSongData[i].body.items)
    }
    return songs
}

async function getSongs(id, offset) {
    var songs = await spotifyApi.getPlaylistTracks(id, { offset: offset })
    return songs
}

const PORT = 3001 || process.env.PORT
app.listen(3001, () => {
    console.log('Running')
})