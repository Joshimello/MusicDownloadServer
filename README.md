# node-spotifuwu
Spotify playlist -> MP3 & ZIP.

## Demo
Frontend demo: [Demo](https://joshimello.github.io/node-spotifuwu/)  
Live demo (might be offline): [Spotifuwu](https://spotifuwu.chibimello.com)

## Installation
Make sure you have [Node.js](https://nodejs.org/en/) and [npm](https://www.npmjs.com) installed.

1. Clone or Download the repository.

	```
	$ git clone https://github.com/Joshimello/node-spotifuwu.git
	$ cd node-spotifuwu
	```
2. Install Dependencies.

	```
	$ npm install
	```
3. Copy or rename config_template.json to config.json, and edit contents.
  
  	```
  	{
   	  "clientId": your client id from spotify,
	  "clientSecret": your client secret from spotify,
	  "redirectUri": your redirect uri,
	  "port": the port you want to use
  	}
  	```
4. Start the application.

	```
	$ npm start
	```

## Features
- Input: A spotify playlist id (example input: 3NEKLoQGcF4ltWSW9fDaAw).
- Output: A list of songs with their MP3 download link & zip package.

**Frontend**
- [Bootstrap](https://github.com/twbs/bootstrap): CSS framework.
- [Font Awesome](https://github.com/FortAwesome/Font-Awesome): Some icons.
- [JQuery](https://github.com/jquery/jquery): Load in content after api request.

**Backend**
- [Node.js](https://github.com/nodejs/node): Main runtime.
- [Express](https://github.com/expressjs/express): Web framework.
- [Socket.io](https://github.com/TimeForANinja/node-ytpl): Realtime updates.
- [Spotify Web API Node](https://github.com/thelinmichael/spotify-web-api-node): Wrapper for spotify's api.
- [Youtube Search](https://github.com/appit-online/youtube-search): Grab data from youtube.
- [Ytdl Core](https://github.com/fent/node-ytdl-core): Save data in video format.
- [Ytpl](https://github.com/TimeForANinja/node-ytpl): Wrapper for youtube playlist api.
- [Fluent FFmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg): Transpose video to mp3.
- [Adm Zip](https://github.com/cthackers/adm-zip): Zip up all the mp3.

## To-Do
- Add more music services?
- Error callbacks

## Contribute
Always welcomed to improve anything or add suggestions! 
Of course reading this already makes me happy enough uwu~
