html :

<header>

&#x09;	<h1>3D Carousel Using TweenMax.js \& jQuery</h1>

&#x09;	<h3>A pen by <a href="https://www.twitter.com/johnblazek" target="\_blank">@johnblazek</a></h3>

&#x09;	<div id="fps">Framerate: 0/60 FPS</div>

&#x09;</header>

&#x09;

&#x09;<div id="contentContainer" class="trans3d"> 

&#x09;<section id="carouselContainer" class="trans3d">

&#x09;	<figure id="item1" class="carouselItem trans3d"><div class="carouselItemInner trans3d">1</div></figure>

&#x09;	<figure id="item2" class="carouselItem trans3d"><div class="carouselItemInner trans3d">2</div></figure>

&#x09;	<figure id="item3" class="carouselItem trans3d"><div class="carouselItemInner trans3d">3</div></figure>

&#x09;	<figure id="item4" class="carouselItem trans3d"><div class="carouselItemInner trans3d">4</div></figure>

&#x09;	<figure id="item5" class="carouselItem trans3d"><div class="carouselItemInner trans3d">5</div></figure>

&#x09;	<figure id="item6" class="carouselItem trans3d"><div class="carouselItemInner trans3d">6</div></figure>

&#x09;	<figure id="item7" class="carouselItem trans3d"><div class="carouselItemInner trans3d">7</div></figure>

&#x09;	<figure id="item8" class="carouselItem trans3d"><div class="carouselItemInner trans3d">8</div></figure>

&#x09;	<figure id="item9" class="carouselItem trans3d"><div class="carouselItemInner trans3d">9</div></figure>

&#x09;	<figure id="item10" class="carouselItem trans3d"><div class="carouselItemInner trans3d">10</div></figure>

&#x09;	<figure id="item11" class="carouselItem trans3d"><div class="carouselItemInner trans3d">11</div></figure>

&#x09;	<figure id="item12" class="carouselItem trans3d"><div class="carouselItemInner trans3d">12</div></figure>	

&#x09;</section>

&#x09;</div>



CSS :



html, body{ background-color:#1a948d; }	



body

{ 

&#x09;background-image: url('../images/background.jpg');

&#x09;background-repeat: no-repeat;

&#x09;background-position: top center;

&#x09;width:100%;

&#x09;background-size:cover;

&#x09;height:100%;

&#x09;min-height:1000px;

&#x09;overflow:hidden;

&#x09;font-family: 'quicksandlight', Helvetica, Arial;

&#x09;color:#FFFFFF;

&#x09;text-shadow: -1px -1px 4px rgba(0, 0, 0, .35);

&#x20;   filter: dropshadow(color=#000000, offx=1, offy=1);

}



header

{

&#x09;

&#x09;margin-top:30px;

&#x09;position:absolute;

&#x09;z-index:5;

&#x09;width:420px;

&#x09;padding-top:10px;

&#x09;padding-bottom:10px;



}



h1{

&#x09;

&#x09;font-size:36px;

&#x09;letter-spacing:-2.5px;

&#x09;margin-left:30px;

}



h3{

&#x09;

&#x09;font-size:16px;

&#x09;letter-spacing:-1.5px;

&#x09;margin-top:5px;

&#x09;margin-left:35px;

}



\#fps

{

&#x09;margin-top:5px;

&#x09;margin-left:35px;

}



a

{

&#x09;color:rgba( 255, 255, 255, .65 );

&#x09;text-decoration: none;

}



a:hover

{

&#x09;color:rgba( 255, 255, 255, 1 );

}



/\* hardware accelatator class \*/	

&#x09;.trans3d

&#x09;{

&#x09;	-webkit-transform-style: preserve-3d;

&#x09;	-webkit-transform: translate3d(0, 0, 0);

&#x09;	-moz-transform-style: preserve-3d;

&#x09;	-moz-transform: translate3d(0, 0, 0);

&#x09;	-ms-transform-style:preserve-3d;

&#x09;	-ms-transform: translate3d(0, 0, 0);

&#x09;	transform-style:preserve-3d;

&#x09;	transform: translate3d(0, 0, 0);



&#x09;	/\*-webkit-backface-visibility: hidden;

&#x09;	-moz-backface-visibility: hidden;

&#x09;	-ms-backface-visibility:hidden;

&#x09;	backface-visibility:hidden;\*/

&#x09;}

&#x09;

&#x09;#contentContainer

&#x09;{

&#x09;	position:absolute;

&#x09;	margin-left:-500px;

&#x09;	margin-top:-500px;

&#x09;	left:50%;

&#x09;	top:50%;

&#x09;	width:1000px;

&#x09;	height:1000px;

&#x09;}

&#x09;

&#x09;#carouselContainer

&#x09;{

&#x09;	position:absolute;

&#x09;	margin-left:-500px;

&#x09;	margin-top:-500px;

&#x09;	left:50%;

&#x09;	top:50%;

&#x09;	width:1000px;

&#x09;	height:1000px;

&#x09;}

&#x09;

&#x09;.carouselItem

&#x09;{

&#x09;	width:320px;

&#x09;	height:130px;

&#x09;	position:absolute;

&#x09;	left:50%;

&#x09;	top:50%;

&#x09;	margin-left:-160px;

&#x09;	margin-top:-90px;

&#x09;	visibility:hidden;

&#x09;}

&#x09;

&#x09;.carouselItemInner

&#x09;{

&#x09;	width:320px;

&#x09;	height:130px;

&#x09;	position:absolute;

&#x09;	background-color:rgba(255, 255, 255, .75);

&#x09;	border:10px solid rgba(255, 255, 255, .5);

&#x09;	color:aqua;

&#x09;	font-size:72px;

&#x09;	left:50%;

&#x09;	top:50%;

&#x09;	margin-left:-160px;

&#x09;	margin-top:-90px;

&#x09;	text-align:center;

&#x09;	padding-top:50px;

&#x09;	

&#x09;}





JS





// set and cache variables

&#x09;	var w, container, carousel, item, radius, itemLength, rY, ticker, fps; 

&#x09;	var mouseX = 0;

&#x09;	var mouseY = 0;

&#x09;	var mouseZ = 0;

&#x09;	var addX = 0;

&#x09;	

&#x09;	

&#x09;	// fps counter created by: https://gist.github.com/sharkbrainguy/1156092,

&#x09;	// no need to create my own :)

&#x09;	var fps\_counter = {

&#x09;		

&#x09;		tick: function () 

&#x09;		{

&#x09;			// this has to clone the array every tick so that

&#x09;			// separate instances won't share state 

&#x09;			this.times = this.times.concat(+new Date());

&#x09;			var seconds, times = this.times;

&#x20;       

&#x09;			if (times.length > this.span + 1) 

&#x09;			{

&#x09;				times.shift(); // ditch the oldest time

&#x09;				seconds = (times\[times.length - 1] - times\[0]) / 1000;

&#x09;				return Math.round(this.span / seconds);

&#x09;			} 

&#x09;			else return null;

&#x09;		},

&#x20;

&#x09;		times: \[],

&#x09;		span: 20

&#x09;	};

&#x09;	var counter = Object.create(fps\_counter);

&#x09;	

&#x09;	

&#x09;	

&#x09;	$(document).ready( init )

&#x09;	

&#x09;	function init()

&#x09;	{

&#x09;		w = $(window);

&#x09;		container = $( '#contentContainer' );

&#x09;		carousel = $( '#carouselContainer' );

&#x09;		item = $( '.carouselItem' );

&#x09;		itemLength = $( '.carouselItem' ).length;

&#x09;		fps = $('#fps');

&#x09;		rY = 360 / itemLength;

&#x09;		radius = Math.round( (250) / Math.tan( Math.PI / itemLength ) );

&#x09;		

&#x09;		// set container 3d props

&#x09;		TweenMax.set(container, {perspective:600})

&#x09;		TweenMax.set(carousel, {z:-(radius)})

&#x09;		

&#x09;		// create carousel item props

&#x09;		

&#x09;		for ( var i = 0; i < itemLength; i++ )

&#x09;		{

&#x09;			var $item = item.eq(i);

&#x09;			var $block = $item.find('.carouselItemInner');

&#x09;			

&#x20;       //thanks @chrisgannon!        

&#x20;       TweenMax.set($item, {rotationY:rY \* i, z:radius, transformOrigin:"50% 50% " + -radius + "px"});

&#x09;			

&#x09;			animateIn( $item, $block )						

&#x09;		}

&#x09;		

&#x09;		// set mouse x and y props and looper ticker

&#x09;		window.addEventListener( "mousemove", onMouseMove, false );

&#x09;		ticker = setInterval( looper, 1000/60 );			

&#x09;	}

&#x09;	

&#x09;	function animateIn( $item, $block )

&#x09;	{

&#x09;		var $nrX = 360 \* getRandomInt(2);

&#x09;		var $nrY = 360 \* getRandomInt(2);

&#x09;			

&#x09;		var $nx = -(2000) + getRandomInt( 4000 )

&#x09;		var $ny = -(2000) + getRandomInt( 4000 )

&#x09;		var $nz = -4000 +  getRandomInt( 4000 )

&#x09;			

&#x09;		var $s = 1.5 + (getRandomInt( 10 ) \* .1)

&#x09;		var $d = 1 - (getRandomInt( 8 ) \* .1)

&#x09;		

&#x09;		TweenMax.set( $item, { autoAlpha:1, delay:$d } )	

&#x09;		TweenMax.set( $block, { z:$nz, rotationY:$nrY, rotationX:$nrX, x:$nx, y:$ny, autoAlpha:0} )

&#x09;		TweenMax.to( $block, $s, { delay:$d, rotationY:0, rotationX:0, z:0,  ease:Expo.easeInOut} )

&#x09;		TweenMax.to( $block, $s-.5, { delay:$d, x:0, y:0, autoAlpha:1, ease:Expo.easeInOut} )

&#x09;	}

&#x09;	

&#x09;	function onMouseMove(event)

&#x09;	{

&#x09;		mouseX = -(-(window.innerWidth \* .5) + event.pageX) \* .0025;

&#x09;		mouseY = -(-(window.innerHeight \* .5) + event.pageY ) \* .01;

&#x09;		mouseZ = -(radius) - (Math.abs(-(window.innerHeight \* .5) + event.pageY ) - 200);

&#x09;	}

&#x09;	

&#x09;	// loops and sets the carousel 3d properties

&#x09;	function looper()

&#x09;	{

&#x09;		addX += mouseX

&#x09;		TweenMax.to( carousel, 1, { rotationY:addX, rotationX:mouseY, ease:Quint.easeOut } )

&#x09;		TweenMax.set( carousel, {z:mouseZ } )

&#x09;		fps.text( 'Framerate: ' + counter.tick() + '/60 FPS' )	

&#x09;	}

&#x09;	

&#x09;	function getRandomInt( $n )

&#x09;	{

&#x09;		return Math.floor((Math.random()\*$n)+1);	

&#x09;	}

