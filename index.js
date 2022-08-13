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
var AdmZip = require('adm-zip')

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'))
const spotifyApi = new SpotifyWebApi({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri
})

const app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname+'/html/main.html'))

    spotifyApi.clientCredentialsGrant()
    .then((data) => {
        spotifyApi.setAccessToken(data.body['access_token'])
    }, (err) => {
        console.log('Error', err)
    })
})

app.get('/music/:file', (req, res) => {
    res.download(
        path.join(__dirname, 'music/' + req.params.file),
        (err) => {
            if (err) res.status(404).send("<pre>404</pre>")
        }
    )
})

app.get('/api/:playlistid', (req, res) => {
    getAllSongs(req.params.playlistid)
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
                    track_ids.push({'name': song, 'id': res[0].id.videoId})
                } else {
                    unfound.push(song)
                }
            })
        })

        // check if links all found
        const track_ids_check = () => {
            if (track_ids.length != tracks.length - unfound.length) {
                console.log(track_ids.length)
                setTimeout(track_ids_check, 200)
            } else {
                console.log(track_ids.length)
                unfound.length == 0 ? null : console.log(unfound)

                // youtube api data -> get video -> ffmpeg to mp3 -> get link & zip
                let mp3_links = []

                if (!fs.existsSync('music')) {
                    fs.mkdirSync('music');
                }

                var zip = new AdmZip()

                track_ids.forEach((song) => {

                    let stream = ytdl(song.id, {
                        quality: 'highestaudio'
                    })

                    ffmpeg(stream)
                    .audioBitrate(128)
                    .save(`music/${song.name}.mp3`)
                    .on('end', () => {
                        mp3_links.push([`http://${req.headers.host}/music/${song.name}.mp3`, song.name])
                        zip.addLocalFile(`music/${song.name}.mp3`);
                    })
                })

                // check if all files downloaded -> zip up -> send data to client
                const mp3_links_check = () => {
                    if (mp3_links.length != tracks.length - unfound.length) {
                        console.log(mp3_links.length)
                        setTimeout(mp3_links_check, 500)
                    } else {
                        zip.writeZip(`music/${req.params.playlistid}.zip`)

                        let final_data = {
                            'zipped': `http://${req.headers.host}/music/${req.params.playlistid}.zip`,
                            'songs': mp3_links
                        }

                        res.json(final_data)
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