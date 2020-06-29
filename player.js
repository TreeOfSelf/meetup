// 2. This code loads the IFrame Player API code asynchronously.
  var tag = document.createElement('script');

  tag.src = "https://www.youtube.com/iframe_api";
  var firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

  // 3. This function creates an <iframe> (and YouTube player)
  //    after the API code downloads.
  var player;
  function onYouTubeIframeAPIReady() {
	player = new YT.Player('player', {
	  height: '300',
	  width: '420',
	  videoId: 'yVxOBEKzkkg',
	  events: {
		'onReady': onPlayerReady,
		'onStateChange': onPlayerStateChange
	  }
	});
	resizeThis();
  }
  
  sendState=1;
  lastPause=0;
  player_send=function(data){
	  if(sendState==1){
		peer_sendData(JSON.stringify(data));
	  }else{
		  sendState=1;
	  }
  }

  // 4. The API will call this function when the video player is ready.
  function onPlayerReady(event) {
	//event.target.playVideo();
	//event.target.play();
  }

  // 5. The API calls this function when the player's state changes.
  //    The function indicates that when playing a video (state=1),
  //    the player should play for six seconds and then stop.
  var done = false;
  function onPlayerStateChange(event) {
	  
	console.log(event);
	  switch(event.data){
		  //play
		  case 1:
			player_send(['video_play',player.getCurrentTime()]);
		  break;
		  //pause
		  case 2:
			if(lastPause!=player.getCurrentTime()){
				player_send(['video_pause',player.getCurrentTime()])
				lastPause=player.getCurrentTime();
			}
		  break;
	  }
	/*if (event.data == YT.PlayerState.PLAYING && !done) {
	  setTimeout(stopVideo, 6000);
	  done = true;
	}*/
  }
  function stopVideo() {
	player.stopVideo();
  }