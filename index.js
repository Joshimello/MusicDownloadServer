const path = require('path')
const http = require('http')
const fs = require('fs')
const express = require('express')
const bodyParser = require('body-parser')
const SpotifyWebApi = require('spotify-web-api-node')
const youtubeApi = require('youtube-search-without-api-key')
const readline = require('readline')
const ytdl = require('ytdl-core')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
const ffmpeg = require('fluent-ffmpeg')
const AdmZip = require('adm-zip')
const socketio = require('socket.io')

ffmpeg.setFfmpegPath(ffmpegPath)
const app = express()
const server = http.createServer(app)
const io = socketio(server)
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'))
const spotifyApi = new SpotifyWebApi({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri
})

// create download folder
if (!fs.existsSync('music')) {
    fs.mkdirSync('music');
}

// send main.html & grant spotify access
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname+'/html/main.html'))

    spotifyApi.clientCredentialsGrant()
    .then(
        data => { spotifyApi.setAccessToken(data.body['access_token']) },
        err => { console.log('Error', err) }
    )
})

// open music folder for download requests
app.get('/music/:file', (req, res) => {
    res.download(
        path.join(__dirname, 'music/' + req.params.file),
        (err) => {
            if (err) res.status(404).send("<pre>404</pre>")
        }
    )
})

// on get reqest
app.get('/api/:playlistid', (req, res) => {

    if (req.params.playlistid.length != 22) {
        res.json({ error: 'Wrong playlist ID' })
        return
    }

    var foundSongs = []
    var unfoundSongs = []
    var zip = new AdmZip()

    getAllSongs(req.params.playlistid)
    .then(songList => {

        let promises = []
        songList.forEach(songData => {

            promises.push( new Promise(resolve => {

                youtubeApi.search(`${songData.track.name} ${songData.track.artists[0].name} audio`)
                .then(foundSongID => {

                    console.log(foundSongID[0].id.videoId)

                    if (foundSongID[0].id.videoId.length == 0) { unfoundSongs.push(songData.track.name) }
                    else {

                        let songFileName = `${songData.track.artists[0].name} - ${songData.track.name}.mp3`
                        ffmpeg( ytdl( foundSongID[0].id.videoId, {quality: 'highestaudio'}) )
                        .audioBitrate(128).save(`music/${songFileName}`).on('end', () => {

                            foundSongs.push([`http://${req.headers.host}/music/${songFileName}`, songFileName])
                            zip.addLocalFile(`music/${songFileName}`)
                            resolve()

                        })
                    }
                })
            }))
        })

        Promise.all(promises).then(() => {

            zip.writeZip(`music/${req.params.playlistid}.zip`)
            foundSongs.length == 0 ? foundSongs.push(['https://youtu.be/dQw4w9WgXcQ', 'Empty Playlist? Here is a song to add!']) : null
            res.json({
                'zipped': `http://${req.headers.host}/music/${req.params.playlistid}.zip`,
                'songs': foundSongs
            })

        })
    })

    .catch(err => {
        console.log(err)
        if (err.body.error.message == 'Bad request') {
            res.json({ error: 'Invalid playlist ID' })
            return
        }
        
        if (err.body.error.message == 'No token provided') {
            res.json({ error: 'Refresh the page' })
            return
        }
        
        res.json({ error: 'Unknown error' })
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

server.listen(config.port || process.env.PORT, () => {
    console.log(`Server running on port ${config.port}`)
})