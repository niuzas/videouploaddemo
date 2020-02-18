import 'dotenv/config';
import express from 'express';

//file system - we need this to delete files after they are uploaded.
var fs = require('fs');
//apivideo
const apiVideo = require('@api.video/nodejs-sdk');
//set up api.video client with my production key
//I keep my key in a .env file to keep it private.
//if you have a .env file, make sure you add it to your .gitignore file
var client = new apiVideo.Client({ apiKey: process.env.apivideoKeyProd});


//using intercom to read the email address and save as a contact
var Intercom = require('intercom-client');
var intercomClient = new Intercom.Client({ token: process.env.intercomToken });
//express for the website and pug to create the pages
const app = express();
const pug = require('pug');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine','pug');
app.use(express.static('public/'));
//favicons are the cool liettle icon ib the tab
var favicon = require('serve-favicon');
app.use(favicon('public/icon.ico')); 


//formidable takes the form data and saves the file, and parameterises the fields into JSON
const formidable = require('formidable')
//email-validator to validate the email address
var validator = require("email-validator");

//ctreate timers to measure upload and processing timings
    let startUploadTimer;
	let uploadCompleteTimer;
	let playReadyTimer;

//get request is the initial request - loads the start.pug
//start.pug has the form
app.get('/', (req, res) => {
  return res.render('start');
});

//the form posts the data to the same location
//so now we'll deal with the submitted data
app.post('/', (req,res) =>{
	
    //formidable reads the form
	var form = new formidable.IncomingForm();
	//use .env feil to set the directory for the video uploads
	//since we will be deleting the files after they uplaod to api.video
	//make sure this directory is full write and delete
	form.uploadDir = process.env.videoDir;
	
	//TODO form validation (mp4 file type, etc)
	form.parse(req, (err, fields, files) => {
    if (err) {
		console.error('Error', err);
		throw err;
    }
	//testing - writing fields and info on the file to the log
    console.log('Fields', fields);
    //console.log('Files', files.source);
	//console.log('file size', files.source.size);
	//console.log('file path', files.source.path);
	
	//mp4 support must be boolean - so set to false
	//then modify to true if the form has it set to true
	let mp4Support = false;
	if (fields.mp4 =="true"){
		mp4Support = true;	
	}
	//if email address is added use prod
	console.log('valid email?', fields.email, validator.validate(fields.email));
	if(validator.validate(fields.email)){
		//prod
        console.log("using production!");
		//there is a valid email address, let's write it to Indercom
		// Create a contact with attributes
		intercomClient.leads.create({ email: fields.email}, function (r) {
		  console.log(r);
		});
		
	}else{
		//sandbox
		//set up api.video client with my sandbox key
		client = new apiVideo.ClientSandbox({ apiKey: process.env.apivideoKeySandBox});
		console.log("using sandbox!");
	}
		
	//metadata must be converted into an array
	
	//uploading.  Timers are for a TODO measuring upload & parsing time
	startUploadTimer = Date.now();
	console.log("start upload", startUploadTimer);
	let result = client.videos.upload(files.source.path, {title: fields.title, description: fields.description, mp4Support: mp4Support});
	
	//the result is the upload response
	//see https://docs.api.video/5.1/videos/create-video
	//for JSON details
	result.then(function(video) {
		uploadCompleteTimer = Date.now();
		console.log("upload complete", uploadCompleteTimer);
	   //delete file on node server
		fs.unlink(files.source.path, function (err) {
    	if (err) throw err;
    	// if no error, file has been deleted successfully
    	console.log('File deleted!');
		}); 
		
	  //read information from API.video	upload JSON response
	  console.log('video', video);
	  let videoId = video.videoId;
	  console.log('videoId', videoId);
	  console.log('player', video.assets.player);
	  let iframe = video.assets.iframe;
	  let player = video.assets.player;
	  //check video status until it is published
	  //when video is playable resturn the video page
	  videoStatus(video);
		 //this means that the video is now playable
		  //so load video.pug, to display the video to the user.
	  function videoStatus(video) {
	  	//console.log(video);
	  	let videoId = video.videoId;
	  	let iframe  = video.assets.iframe;
	  	let playable = false;
	  	let status = client.videos.getStatus(videoId);
	      status.then(function(videoStats){
	      	//console.log('status', status);
	  		playable = videoStats.encoding.playable;
	  		console.log('video playable?',videoStats.encoding.playable, playable);
	  		if (playable){
	  			//video is ready to be played
	  			console.log("ready to play the video");
	  			playReadyTimer = Date.now();
				let uploadSeconds = (uploadCompleteTimer-startUploadTimer)/1000;
				let processSeconds = (playReadyTimer - uploadCompleteTimer)/1000;
				console.log("video uploaded in: ", uploadSeconds);
				console.log("video processed in: ", processSeconds);
	  			console.log(iframe);
	  			return res.render('video', {iframe, player, uploadSeconds,processSeconds});	
	  		}else{
	  			//not ready so check again in 2 seconds.
	  			console.log("not ready yet" );
	  			setTimeout(videoStatus(video),2000);
	  		}
	  	}).catch(function(error) {
	  	  console.error(error);
	  	});;	
	  }  
	
	  
      
	  
	  
	//if upload fails  
	}).catch(function(error) {
	  console.error(error);
	});
	
	console.log(result.response);

  // res.sendStatus(200);	
});
});

app.listen(3000, () =>
  console.log('Example app listening on port 3000!'),
);