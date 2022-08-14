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
const AdmZip = require('adm-zip')

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'))
const spotifyApi = new SpotifyWebApi({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri
})

const app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// send main.html & grant spotify access
app.get('.', (req, res) => {
    res.sendFile(path.join(__dirname+'/html/main.html'))

    spotifyApi.clientCredentialsGrant()
    .then((data) => {
        spotifyApi.setAccessToken(data.body['access_token'])
    }, (err) => {
        console.log('Error', err)
    })
})

// open music folder for download requests
app.get('music/:file', (req, res) => {
    res.download(
        path.join(__dirname, 'music/' + req.params.file),
        (err) => {
            if (err) res.status(404).send("<pre>404</pre>")
        }
    )
})

var in_progress = {}

// main workload script
app.get('api/:playlistid', (req, res) => {
    let playlistid = req.params.playlistid
    in_progress[playlistid] = {
        'text': {
            'task': 'Loading',
            'name': 'Loading',
        },
        
        'number': {
            'index': 0,
            'goal': 0
        }
    }

    if (playlistid.length != 22) {
        res.json({
            error: 'Wrong playlist ID'
        })

        return
    }

    getAllSongs(playlistid)
    .then((data) => {

        // process tracks: spotify api -> filtered song & artist
        let tracks = []

        data.forEach((track) => {
            tracks.push(track.track.name + ' - ' + track.track.artists[0].name)
        })

        // get youtube link: filtered song & artist -> youtube api
        let track_ids = []
        let unfound = []

        tracks.forEach((song, index) => {
            youtubeApi.search(song + 'audio')
            .then((res) => {
                if (res.length != 0) {
                    track_ids.push({'name': song, 'id': res[0].id.videoId})
                } else {
                    unfound.push(song)
                }

                Object.assign(in_progress[playlistid].text = {
                    'task': 'Quarrying',
                    'name': song
                })
            })
        })

        // check if links all found
        const track_ids_check = () => {
            if (track_ids.length != tracks.length - unfound.length) {

                Object.assign(in_progress[playlistid].number = {
                    'index': track_ids_check,
                    'goal': tracks.length
                })

                setTimeout(track_ids_check, 200)
            } else {
                unfound.length == 0 ? null : console.log(unfound)

                // youtube api data -> get video -> ffmpeg to mp3 -> get link & zip
                let mp3_links = []

                if (!fs.existsSync('music')) {
                    fs.mkdirSync('music');
                }

                var zip = new AdmZip()

                track_ids.forEach((song, index) => {

                    let stream = ytdl(song.id, {
                        quality: 'highestaudio'
                    })

                    ffmpeg(stream)
                    .audioBitrate(128)
                    .save(`music/${song.name}.mp3`)
                    .on('end', () => {
                        mp3_links.push([`http://${req.headers.host}/music/${song.name}.mp3`, song.name])
                        zip.addLocalFile(`music/${song.name}.mp3`);

                        Object.assign(in_progress[playlistid].text = {
                            'task': 'Downloading',
                            'name': song.name
                        })
                    })
                })

                // check if all files downloaded -> zip up -> send data to client
                const mp3_links_check = () => {
                    if (mp3_links.length != tracks.length - unfound.length) {

                        Object.assign(in_progress[playlistid].number = {
                            'index': mp3_links.length,
                            'goal': tracks.length
                        })

                        setTimeout(mp3_links_check, 500)
                    } else {
                        zip.writeZip(`music/${playlistid}.zip`)

                        mp3_links.length == 0 ? mp3_links.push(['https://youtu.be/dQw4w9WgXcQ', 'Empty Playlist? Here is a song to add!']) : null

                        delete in_progress[playlistid]

                        let final_data = {
                            'zipped': `http://${req.headers.host}/music/${playlistid}.zip`,
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
    .catch((err) => {
        if (err.body.error.message == 'Bad request') {
            res.json({
                error: 'Invalid playlist ID'
            })
            return
        }
        
        if (err.body.error.message == 'No token provided') {
            res.json({
                error: 'Refresh the page'
            })
            return
        }
        
        res.json({
            error: 'Unknown error'
        })
    })
})

// socket for tracking progress
app.get('api/socket/:playlistid', (req, res) => {
    res.json(in_progress[req.params.playlistid])
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