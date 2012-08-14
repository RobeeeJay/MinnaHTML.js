MinnaHTML.js
============

An async aware HTML object library primarily aimed at Node.js users



License
=======

This library is released under the GNU General Public License v3:
http://www.gnu.org/copyleft/gpl.html



To Do
=====

Add a lot more documentation
Add remaining missing HTML objects



About the Author
================

MinnaHTML was written by Robee Shepherd, after some 13 years of developing web applications. Having been coding since the age of 10, starting with BASIC and then Z80 assembley language on the ZX-81 and ZX Spectrum, Robee has journeyed through the hell of 16-bit DOS and Windows development in C/C++ where pointers regularly wrapped around, through 32-bit Windows, the early days of ASP and finally to the modern joyous world of Node.JS.

That's quite a lot of programming experience, with so little to show for it.



What's It Do?
=============

MinnaHTML is a very easy to grasp, simple object oriented library for the quick generation of webpages with as little or as much object oriented code as the user desires.

As importantly, it is async aware, which means you can use it to pass off a DIV object to a function with a callback, and not worry about delivering an incomplete HTML file to the end client.



Quick Walkthrough
=================

MinnaHTML objects map directly to HTML objects, in an obvious and simple to remember syntax:

	new mh.OBJECT(parent, cid, vars, blankId)


Where the arguments are as follows:

	parent = a parent MinnaHTML object for this to belong to
	cid = an optional string representing the id of the object (eg. "maindiv")
	vars = an optional object containing any attributes you wish to add to the HTML object (eg. "{ class: 'pretty' }")
	blankId = an optional boolean for hiding the id of the object


That's pretty much all there is too it! Well, okay the objects have helper functions for adding/removing parents, finding child objects, iterating with functions, and so on, much like you are used to with jQuery. But more on that later.


Firstly, the most basic example possible:

	var objEntireWebpage = new mh.Html();
	
	objEntireWebpage.data.content = "<head><title>Simple Webpage</title></head>";
	objEntireWebpage.data.content += "<body><p>Very little to see here!</p></body>";


Now, if you call objEntireWebpage.generateHtml() it would return the following as a string:

	<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
	<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
	 <head><title>Simple Webpage</title></head><body><p>Very little to see here!</p></body>
	</html>


Let's rewrite it using more objects!

	var objEntireWebpage = new mh.Html();
	
	var objHeadSection = new mh.Head(objEntireWebpage);
	new mh.Title(objHeadSection).data.content = "Simple Webpage";
	
	var objBodySection = new mh.Body(objEntireWebpage);
	new mh.Paragraph(objBodySection).data.content = "Very little to see here!";


Calling objEntireWebpage.generateHtml() would return the following as a string, which is pretty much the same as we had before but with prettier easy to read auto-indenting:

	<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
	<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
	 <head>
	  <title>
	   Simple Webpage
	  </title>
	 </head>
	 <body>
	  <p>
	   Very little to see here!
	  </p>
	 </body>
	</html>


Hopefully the smarter of you are already starting to see the possibilities of this method for generating pages. Because they are represented in an efficient object hierarchy, you can start to do things to pages in a much more flexible way than having one big template that you search and replace on.

Got a standard bit of code that pulls a twitter feed and shoves it in a DIV? Stick it in a function which gets passed a mh.Div object and away it goes. It doesn't have to know anything other than to fill that object with its data, the context of that data can switch between thrown in a full page, to delivered via AJAX to a browser client.

Furthermore, if you build webapps using an OOP design, MinnaHTML slots in perfectly into this scenario. An object near the top of your tree can create objects that represent the basics of your webpages, and derived objects can easily add to the content as and when required.


One little thing to note, you can reference objects by their ID, and any property of that object (excluding data, which is a special property you shouldn't mess with without understanding), will become a parameter of that object. Here are some quick example and the HTML it would generate:

	var objDiv = new mh.Div(null, "dog", { class: "notacat", onclick: "alert('Woof')");
	new mh.Paragraph(objDiv, "cat");
	objDiv.cat.data.content = "I'm not a dog!";
	
	<div class="notacat" onclick="alert('Woof')">
		<p>
			I'm not a dog!
		</p>
	</div>


If you haven't worked it out already, object.data.content can be set to contain a string which becomes the content of the HTML object. Note that setting this to a string changes how children of this object behave. Setting this string trumps children, and the only way children of this object will appear is via a search and replace on text in this string that includes the format [[child_id]]. Eg.

	var objDiv = new mh.Div();
	objDiv.data.content = "Some text [[child_dog]] surrounding a div";
	var objChild = new mh.Div(objDiv, "dog");
	
	<div>
		Some text <div id="dog">
		</div> surrounding a div
	</div>



Async Ready!
============

One thing that requires a lot of thought with Node.js, is the simple question, "How do I ensure my document is ready before I send it?" Well, if you use MinnaHTML then you don't have to worry too much about that, because it can handle this for you via the following object functions:

	object.isReady()
	Tells an object that it is unfinished and should prevent any page generation from taking place
	
	object.notReady()
	Tells an object that it is ready and that page generation can safely take place

	object.whenReady(callback)
	When an object (and all its children) is safely marked as ready, calls the callback function with the generated HTML


Now first off, all objects start off in the ready state. And calling whenReady() can result in the callback being fired immediately.

With that in mind, the following should demonstrate how this works:

	var objEntireWebpage = new mh.Html();
	
	var objHeadSection = new mh.Head(objEntireWebpage);
	new mh.Title(objHeadSection).data.content = "Simple Webpage";
	
	var objBodySection = new mh.Body(objEntireWebpage);

	objBodySection.notReady();
	
	objEntireWebpage.whenReady(function(strHtml) {
		console.log(strHtml);
	});
	
	setTimeout(function() {
		new mh.Paragraph(objBodySection).data.content = "Very little to see here!";
		objBodySection.isReady();
	}, 3000);


The objBodySection object is declared not ready, because we still have to add our epic paragraph to it. For the objEntireWebpage object which all the others ultimately belong to, we tell it to call an anonymous function when it is ready, that lists the generated HTML to the console.

The setTimeout function simulates a process that might take a bit of time, or at least is asynchronous, and after 3 seconds it adds the paragraph to the body section object, and then declares that to be ready.

Since in this case, declaring objBodySection as ready means the entire object tree is ready, this immediately calls the callback we passed to whenReady().

This general approach to representing the final delivered document as an object tree hierarchy, which is aware of its state of readyness, makes delivering full content pages via Node.js very easy all of a sudden.

Create a load of DIV objects, add them to your body, them not ready, make a load of async database calls to get the info you need to fill them, and when they are all ready your callback of choice is fired which can send it instantly to the client. No waiting around.



There Is More
=============

Sending data to the client via AJAX? You can use a PlaceHolder object that itself generates no HTML, just to abuse it's async features, or add plain text data to it or JSON, or use it to send dynamic HTML to insert into the client.

You can iterate through objects, search for them, add and remove parents, add and remove children, 