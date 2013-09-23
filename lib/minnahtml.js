/*******************************************************************************************

FILE
	minnahtml.js

DESCRIPTION
	The basic MinnaHTML class objects for building webpages

*******************************************************************************************/

// Inheritance function from http://www.sitepoint.com/javascript-inheritance/
var copyPrototype = function(descendant, parent) {  
	var sConstructor = parent.toString();  
	var aMatch = sConstructor.match( /\s*function (.*)\(/ );  
	if ( aMatch != null ) { descendant.prototype[aMatch[1]] = parent; }  
	for (var m in parent.prototype) {  
		descendant.prototype[m] = parent.prototype[m];  
	}
};  

// A RegExp used to match a child object placeholder in content
var reChildPlaceholder = new RegExp("\\[\\[child_([a-z0-9-_]+)]]", "ig");

// The base number for the cid generator
var intCidBase = 65536;


// -------------------------------------------------------------------------------------------------
// data object used to store tag/cid/parent/content info
// -------------------------------------------------------------------------------------------------

// Data constructor
function Data(parent, tag, cid)
{
	this.tag = tag;
	this.cid = cid;
	this.parent = parent;
	this.content = null;
	this.readycount = 0;
	this.readycallback = null;
	this.abort = false;
	this.childlist = new Array();
	this.preready = null;
}


// -------------------------------------------------------------------------------------------------
// <base> class for all HTML objects
// -------------------------------------------------------------------------------------------------

// Base constructor
function Base(parent, tag, cid, vars, blankId)
{
	if (!cid)
	{
		cid = this.makeUcid();
		blankId = true;
	}
	
	this.data = new Data(parent, tag, cid);

	if (cid && !blankId)
		this.id = cid;
		
	if (parent)
		parent.addChild(this);
	
	if (vars)
		this.addArgs(vars);
}

// Generate an unused cid
Base.prototype.makeUcid = function(child)
{
	intCidBase++;
	
	if (!intCidBase)
		intCidBase = 65536;

	return intCidBase.toString(16);
}

// Add a child object to this HTML object
Base.prototype.addChild = function(child)
{
	this[child.data.cid] = child;
	this.data.childlist.push(child.data.cid);
	child.data.parent = this;
	if (child.data.readycount)
		this.notReady(child.data.readycount, true);
}
	
// Removes a child object from this HTML object
Base.prototype.removeChild = function(child)
{
	// We remove this before we make the parent ready in case it fires off generation
	this[child.data.cid] = null;
	
	child.data.parent = null;
	
	if (child.data.readycount)
		this.isReady(child.data.readycount, true);
	if (this.data.readycount < 0)
		this.data.readycount = 0;
}

// Add a parent object to this HTML object
Base.prototype.addParent = function(parent)
{
	this.removeParent();
	
	parent.addChild(this);
}

// Returns the parent object to this HTML object
Base.prototype.getParent = function(parent)
{
	return this.data.parent;
}

// Removes a parent object from this HTML object
Base.prototype.removeParent = function()
{
	if (this.data.parent)
		this.data.parent.removeChild(this);
}

// Makes this object ready, and tells parent it is ready
Base.prototype.isReady = function(intLevels)
{
	var intChildReady;
	
	if (!intLevels || (intLevels < 1))
		intLevels = 1;
		
	// Check for children
	intChildReady = 0;
	this.eachChild(function(obj) {
			intChildReady += obj.data.readycount;
		});
		
	// Our ready counter must be at least greater than the sum of the children counters
	if (this.data.readycount >= (intChildReady - intLevels))
		this.data.readycount -= intLevels;
	else
		this.data.readycount = intChildReady;
	
	// Tell the parent we are ready so it can update its status
	if (this.data.parent)
		this.data.parent.isReady(intLevels, true);
	
	// If we have a readycallback set, we call it if we are now ready
	if (this.checkReady() && this.data.readycallback)
		this.data.readycallback(this);
}

// Makes this object ready, and tells parent it is ready
Base.prototype.notReady = function(intLevels)
{
	if (!intLevels || (intLevels < 1))
		intLevels = 1;
	this.data.readycount += intLevels;
	
	if (this.data.parent)
		this.data.parent.notReady(intLevels, true);
}

// Not only makes this object notready, but marks it to abort on HTML generation
Base.prototype.abort = function()
{
	this.data.abort = true;
	this.notReady();
}

// Returns if this object is ready or not
Base.prototype.checkReady = function()
{
	if (this.data.readycount == 0)
		return true;
	
	return false;
}

// Sets a callback to be used when this object is ready
Base.prototype.preReady = function(callback)
{
	this.data.preready = callback;
}

// Calls a function if this object is ready, or sets it so isReady calls it later
Base.prototype.whenReady = function(callback)
{
	var self = this;

	// If this page is ready, we call the func with it now, otherwise we let it call when its ready
	if (this.checkReady())
		callback(this.generateHtml());
	else
		this.data.readycallback = function() {
			// Only call this if no attempt has been made to abort this item generation
			if (!self.data.abort)
				callback(self.generateHtml());
		};
}

// Add some content to this HTML object
Base.prototype.addContent = function(string)
{
	if (!this.data.content)
		this.data.content = "";
	
	this.data.content += string;
}

// Replaces the content of this HTML object
Base.prototype.replaceContent = function(string)
{
	if (!this.data.content)
		this.data.content = "";
	
	this.data.content == string;
}

// Adds multiple args to this HTML object
Base.prototype.addVars = function(vars)
{
	for (var key in vars)
		this.addToVar(key, vars[key]);
}

// Adds to a string var of this HTML object if it exists, or creates it if not
Base.prototype.addToVar = function(key, value)
{
	if (this[key])
		this[key] += " " + value;
	else
		this[key] = value;
}

// Returns if a member of this object is a child object
Base.prototype.validChild = function(obj)
{
	if (obj == null)
		return false;
		
	if ((typeof(obj) == 'object') && obj.data && obj.data.cid)
		return true;
	return false;
}

// Calls a function for each child of this HTML object
Base.prototype.eachChild = function(func)
{
	if (this.data.childlist.length == 0)
		return;
		
	for (var u = 0; u < this.data.childlist.length; u++)
	{
		if (this.validChild(this[this.data.childlist[u]]))
			func(this[this.data.childlist[u]]);
	}
}

// Returns whether this object has children
Base.prototype.hasChildren = function()
{
	// Iterate our property list
	for (var key in this)
	{
		if (this.validChild(this[key]))
			return true;
	}
	
	return false;
}

// Returns (if found) the HTML object before this one
Base.prototype.prevObject = function()
{
	var objParent;
	
	objParent = this.data.parent;

	if (objParent && (objParent.data.childlist.length > 1))
	{
		for (var u = 0; u < objParent.data.childlist.length; u++)
		{
			if (objParent.data.childlist[u] == this.data.cid)
			{
				if (u == 0)
					return null;
				
				return objParent[objParent.data.childlist[u - 1]];
			}
		}
	}
	
	return null;
}

// Returns (if found) the HTML object after this one
Base.prototype.nextObject = function()
{
	var objParent;
	
	objParent = this.data.parent;
	
	if (objParent && (objParent.data.childlist.length > 1))
	{
		for (var u = 0; u < objParent.data.childlist.length; u++)
		{
			if (objParent.data.childlist[u] == this.data.cid)
			{
				if (u == (objParent.data.childlist.length - 1))
					return null;
				
				return objParent[objParent.data.childlist[u + 1]];
			}
		}
	}
}

// Returns (if found) the HTML object that matches this tag or cid
Base.prototype.findObject = function(tag, cid)
{
	if (tag && (cid == null))
	{
		for (var key in this)
		{
			if (this.validChild(this[key]))
			{
				if (tag == this[key].data.tag)
					return this[key];
			}
		}
	}
	else if ((tag == null) && cid)
	{
		for (var key in this)
		{
			if (this.validChild(this[key]))
			{
				if (cid == this[key].data.cid)
					return this[key];
			}
		}
	}
	else if (tag && cid)
	{
		for (var key in this)
		{
			if (this.validChild(this[key]))
			{
				if ((cid == this[key].data.cid) && (tag == this[key].data.tag))
					return this[key];
			}
		}
	}
	
	for (var key in this)
	{
		if (this.validChild(this[key]))
		{
			var objObject = this[key].findObject(tag, cid);
			if (objObject)
				return objObject;
		}
	}
	
	return null;
}

// Calls a function for each HTML object self matches this tag or cid
Base.prototype.eachObject = function(tag, cid, func)
{
	var intCount = 0;
	
	if (tag && (cid == null))
	{
		this.eachChild(function(obj) {
				if (tag == obj.data.tag)
				{
					func(obj);
					intCount++;
				}
			});
	}
	else if ((tag == null) && cid)
	{
		this.eachChild(function(obj) {
				if (cid == obj.data.cid)
				{
					func(obj);
					intCount++;
				}
			});
	}
	else if (tag && cid)
	{
		this.eachChild(function(obj) {
				if ((cid == obj.data.cid) && (tag == obj.data.tag))
				{
					func(obj);
					intCount++;
				}
			});
	}
	
	this.eachChild(function(obj) {
			intCount += obj.eachObject(tag, cid, func);
		});
	
	return intCount;
}

// Converts the args of this HTML object to a string
Base.prototype.argsString = function()
{
	var strHtml = "";
	
	// Iterate our property list and add any relevant vars to the tag
	for (var key in this)
	{
		switch (typeof(this[key]))
		{
			case 'number':
			case 'string':
				var thisKey = String(this[key]);
				var strKey = String(key);
				
				if (strKey.substr(0, 4) == "esc_")
					strKey = strKey.substr(4);
				strHtml += " " + strKey + "=\"" + thisKey.replace(/"/g, "'") + "\"";   //" <- fixes editor syntax highlighting
		}
	}
	
	return strHtml;
}

// Adds multiple args to this HTML object to a string
Base.prototype.addArgs = function(vars)
{
	for (var key in vars)
	{
		if (vars[key])
			this[key] = vars[key];
	}
}

// Converts this HTML object to a string
Base.prototype.generateHtml = function(intIndent)
{
	var self = this;
	var strHtml, strIndent, bolHasChildren;
	
	if (this.data.preready)
		this.data.preready();

	if (!intIndent)
		intIndent = 0;
	strIndent = new Array(intIndent + 1).join(" ");
	
	strHtml = strIndent + "<" + this.data.tag;
	strHtml += this.argsString();	
	
	bolHasChildren = this.hasChildren();
	if (typeof(this.data.content) == "number")
		this.data.content = new String(this.data.content);
	
	if (this.data.content || bolHasChildren || (this.data.content === ""))
	{
		strHtml += ">\n";
		
		// Content always superceeds children, but may contain placeholders for children
		if (this.data.content)
		{
			if (bolHasChildren)
			{
				var self = this;
				strHtml += this.data.content.replace(reChildPlaceholder, function($0,$1) {
					if (self[$1] && (self[$1] != null))
						return self[$1].generateHtml(1);
					return $0;
				});
			}
			else
				strHtml += strIndent + " " + this.data.content + "\n";
		}
		else if (bolHasChildren)
		{
			this.eachChild(function(obj) {
					strHtml += obj.generateHtml(intIndent + 1);
				});
		}
		
		strHtml += strIndent +"</" + this.data.tag + ">\n";
	}
	else
		strHtml += " />\n";
	
	return strHtml;
}

// Converts the object into an identifable string
Base.prototype.objectToString = function()
{
	var funcNameRegex = /function (.{1,})\(/;
	var results = (funcNameRegex).exec(this.constructor.toString());
	var strReturn = ((results && results.length > 1) ? results[1] : "");
	if (this.id)
		strReturn += " (" + this.id + ")";
	else
		strReturn += " (" + this.data.cid + ")";
	
	var objParent = this.data.parent;
	
	while (objParent)
	{
		if (objParent.id)
		{
			strReturn += " child of (" + objParent.id + ")";
			break;
		}
		objParent = objParent.data.parent;
	}
	
	return strReturn;
}
	

// -------------------------------------------------------------------------------------------------
// <Html> class
// -------------------------------------------------------------------------------------------------

// Html constructor
function Html(parent, cid, vars, blankId)
{
	this.Base(parent, "html", cid, vars, blankId);
	this.data.docType = "html";
	
	if (parent)
		throw("<html> tag should not have parent");
}

// Inherit from base HTML object
copyPrototype(Html, Base);

// Overload generate function to add Doctype prefix
Html.prototype.generateHtml = function(intIndent)
{
	var strDocType;
	
	strDocType = "<!DOCTYPE " + this.data.docType + ">\n";
	
	return strDocType + Base.prototype.generateHtml.apply(this, arguments);
}


// -------------------------------------------------------------------------------------------------
// <xHtml> class
// -------------------------------------------------------------------------------------------------

// xHtml constructor
function xHtml(parent, cid, vars, blankId)
{
	this.Base(parent, "html", cid, vars, blankId);
	this.data.facebook = false;
	this.data.docType = "html PUBLIC \"-//W3C//DTD XHTML 1.0 Strict//EN\" \"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd\"";
	this.xmlns = "http://www.w3.org/1999/xhtml";
	this["xml:lang"] = "en";
	this.lang = "en";
	
	if (parent)
		throw("<html> tag should not have parent");
}

// Inherit from base HTML object
copyPrototype(xHtml, Base);

// Overload generate function to add Doctype prefix
xHtml.prototype.generateHtml = function(intIndent)
{
	var strDocType;
	
	strDocType = "<!DOCTYPE " + this.data.docType;
	if (this.data.facebook)
		strDocType += " xmlns:fb=\"http://www.facebook.com/2008/fbml\" xmlns:og=\"http://opengraphprotocol.org/schema/\"";
	strDocType += ">\n";
	
	return strDocType + Base.prototype.generateHtml.apply(this, arguments);
}


// -------------------------------------------------------------------------------------------------
// <head> class
// -------------------------------------------------------------------------------------------------

// Head constructor
function Head(parent, cid, vars, blankId)
{
	this.Base(parent, "head", cid, vars, blankId);
	if (parent && (parent.data.tag != "html"))
		throw("<head> tag parent not <html> (is <" + parent.data.tag + ">)");
}

// Inherit from base HTML object
copyPrototype(Head, Base);


// -------------------------------------------------------------------------------------------------
// Childless class
// -------------------------------------------------------------------------------------------------

// Childless constructor
function Childless(parent, tag, cid, vars, blankId)
{
	this.Base(parent, tag, cid, vars, blankId);
}

// Inherit from base HTML object
copyPrototype(Childless, Base);

// Overload addChildren function to throw error if a child is added
Childless.prototype.addChild = function(child)
{
	throw("<" + this.data.tag + "> tag cannot have children");
}


// -------------------------------------------------------------------------------------------------
// <meta> class
// -------------------------------------------------------------------------------------------------

// Meta constructor
function Meta(parent, cid, vars, blankId)
{
	this.Childless(parent, "meta", cid, vars, blankId);
	if (parent && (parent.data.tag != "head"))
		throw("<meta> tag parent not <head> (is <" + parent.data.tag + ">)");
}

// Inherit from base HTML object
copyPrototype(Meta, Childless);


// -------------------------------------------------------------------------------------------------
// <title> class
// -------------------------------------------------------------------------------------------------

// Title constructor
function Title(parent, cid, vars, blankId)
{
	this.Childless(parent, "title", cid, vars, blankId);
	if (parent && (parent.data.tag != "head"))
		throw("<title> tag parent not <head> (is <" + parent.data.tag + ">)");
}

// Inherit from base HTML object
copyPrototype(Title, Childless);


// -------------------------------------------------------------------------------------------------
// <link> class
// -------------------------------------------------------------------------------------------------

// Title constructor
function Link(parent, cid, vars, blankId)
{
	this.Childless(parent, "link", cid, vars, blankId);
	if (parent && (parent.data.tag != "head"))
		throw("<link> tag parent not <head> (is <" + parent.data.tag + ">)");
}

// Inherit from base HTML object
copyPrototype(Link, Childless);


// -------------------------------------------------------------------------------------------------
// Stylesheet class
// -------------------------------------------------------------------------------------------------

// Stylesheet constructor
function StyleSheet(parent, cid, vars, blankId)
{
	this.Link(parent, cid, vars, blankId);
	this.rel = "stylesheet";
	this.type = "text/css";
}

// Inherit from base HTML object
copyPrototype(StyleSheet, Link);


// -------------------------------------------------------------------------------------------------
// RSS feed class
// -------------------------------------------------------------------------------------------------

// RSS feed constructor
function RssFeed(parent, cid, vars, blankId)
{
	this.Link(parent, cid, vars, blankId);
	this.rel = "alternate";
	this.type = "application/rss+xml";
}

// Inherit from base HTML object
copyPrototype(RssFeed, Link);


// -------------------------------------------------------------------------------------------------
// <style> class
// -------------------------------------------------------------------------------------------------

// Style constructor
function Style(parent, cid, vars, blankId)
{
	this.Childless(parent, "style", cid, vars, blankId);
	this.type = "text/css";
	if (parent && (parent.data.tag != "head"))
		throw("<style> tag parent not <head> (is <" + parent.data.tag + ">)");
}

// Inherit from base HTML object
copyPrototype(Style, Childless);


// -------------------------------------------------------------------------------------------------
// <script> class
// -------------------------------------------------------------------------------------------------

// Title constructor
function Script(parent, cid, vars, blankId)
{
	this.Childless(parent, "script", cid, vars, blankId);
	this.type = "text/javascript";
	if (parent && ((parent.data.tag != "head") && (parent.data.tag != "body")))
		throw("<script> tag parent not <head> or <body> (is <" + parent.data.tag + ">)");
}

// Inherit from base HTML object
copyPrototype(Script, Childless);

// Overload generate function to ensure despite being empty both open and close tags are added (fixes an IE bug)
Script.prototype.generateHtml = function(intIndent)
{
	var strHtml, strIndent;
	
	if (!intIndent)
		intIndent = 0;
	strIndent = new Array(intIndent + 1).join(" ");
	
	strHtml = strIndent + "<" + this.data.tag;
	strHtml += this.argsString();	
	strHtml += ">\n";
	
	// Add content for this script if it exists
	if (this.data.content)
		strHtml += strIndent + " " + this.data.content + "\n";
	
	strHtml += strIndent +"</" + this.data.tag + ">\n";
	
	// Add any noscript content if it exists
	if (this.data.noscriptcontent)
	{
		strHtml += strIndent + "<noscript>\n";
		strHtml += strIndent + " " + this.data.noscriptcontent + "\n";
		strHtml += strIndent +"</noscript>\n";
	}
	
	return strHtml;
}


// -------------------------------------------------------------------------------------------------
// <body> class
// -------------------------------------------------------------------------------------------------

// Body constructor
function Body(parent, cid, vars, blankId)
{
	this.Base(parent, "body", cid, vars, blankId);
	if (parent && (parent.data.tag != "html"))
		throw("<body> tag parent not <html> (is <" + parent.data.tag + ">)");
}

// Inherit from base HTML object
copyPrototype(Body, Base);


// -------------------------------------------------------------------------------------------------
// <div> class
// -------------------------------------------------------------------------------------------------

// Div constructor
function Div(parent, cid, vars, blankId)
{
	this.Base(parent, "div", cid, vars, blankId);
}

// Inherit from base HTML object
copyPrototype(Div, Base);

// Overload generate function to ensure despite being empty both open and close tags are added
Div.prototype.generateHtml = function(intIndent)
{
	if (!this.hasChildren() && (this.data.content == null))
		this.data.content = "";
	
	return Base.prototype.generateHtml.apply(this, arguments);
}


// -------------------------------------------------------------------------------------------------
// <h1-6> class
// -------------------------------------------------------------------------------------------------

// Heading constructor
function Heading(parent, cid, vars, blankId)
{
	this.Base(parent, "h1", cid, vars, blankId);
		
	this.data.level = 1;
}

// Inherit from base HTML object
copyPrototype(Heading, Base);

// Overload generate function to make sure there is no content
Heading.prototype.generateHtml = function(intIndent)
{
	this.data.tag = "h" + this.data.level;
	
	return Base.prototype.generateHtml.apply(this, arguments);
}


// -------------------------------------------------------------------------------------------------
// <h2> class
// -------------------------------------------------------------------------------------------------

// Heading constructor
function Heading2(parent, cid, vars, blankId)
{
	this.Heading(parent, cid, vars, blankId);
		
	this.data.level = 2;
}

// Inherit from base HTML object
copyPrototype(Heading2, Heading);


// -------------------------------------------------------------------------------------------------
// <h3> class
// -------------------------------------------------------------------------------------------------

// Heading constructor
function Heading3(parent, cid, vars, blankId)
{
	this.Heading(parent, cid, vars, blankId);
		
	this.data.level = 3;
}

// Inherit from base HTML object
copyPrototype(Heading3, Heading);


// -------------------------------------------------------------------------------------------------
// <h4> class
// -------------------------------------------------------------------------------------------------

// Heading constructor
function Heading4(parent, cid, vars, blankId)
{
	this.Heading(parent, cid, vars, blankId);
		
	this.data.level = 4;
}

// Inherit from base HTML object
copyPrototype(Heading4, Heading);


// -------------------------------------------------------------------------------------------------
// <h5> class
// -------------------------------------------------------------------------------------------------

// Heading constructor
function Heading5(parent, cid, vars, blankId)
{
	this.Heading(parent, cid, vars, blankId);
		
	this.data.level = 5;
}

// Inherit from base HTML object
copyPrototype(Heading5, Heading);


// -------------------------------------------------------------------------------------------------
// <h6> class
// -------------------------------------------------------------------------------------------------

// Heading constructor
function Heading6(parent, cid, vars, blankId)
{
	this.Heading(parent, cid, vars, blankId);
		
	this.data.level = 6;
}

// Inherit from base HTML object
copyPrototype(Heading6, Heading);


// -------------------------------------------------------------------------------------------------
// <p> class
// -------------------------------------------------------------------------------------------------

// Paragraph constructor
function Paragraph(parent, cid, vars, blankId)
{
	this.Base(parent, "p", cid, vars, blankId);
}

// Inherit from base HTML object
copyPrototype(Paragraph, Base);


// -------------------------------------------------------------------------------------------------
// <ul> class
// -------------------------------------------------------------------------------------------------

// Unordered List constructor
function UnorderedList(parent, cid, vars, blankId)
{
	this.Base(parent, "ul", cid, vars, blankId);
}

// Inherit from base HTML object
copyPrototype(UnorderedList, Base);


// -------------------------------------------------------------------------------------------------
// <ol> class
// -------------------------------------------------------------------------------------------------

// Ordered List constructor
function OrderedList(parent, cid, vars, blankId)
{
	this.Base(parent, "ol", cid, vars, blankId);
}

// Inherit from base HTML object
copyPrototype(OrderedList, Base);


// -------------------------------------------------------------------------------------------------
// <li> class
// -------------------------------------------------------------------------------------------------

// List Item constructor
function ListItem(parent, cid, vars, blankId)
{
	this.Base(parent, "li", cid, vars, blankId);
}

// Inherit from base HTML object
copyPrototype(ListItem, Base);


// -------------------------------------------------------------------------------------------------
// <img> class
// -------------------------------------------------------------------------------------------------

// Image constructor
function Image(parent, cid, vars, blankId)
{
	this.Childless(parent, "img", cid, vars, blankId);
}

// Inherit from base HTML object
copyPrototype(Image, Childless);

// Overload generate function to make sure there is no content
Image.prototype.generateHtml = function(intIndent)
{
	if (this.data.content)
		this.data.content = null;
	
	return Childless.prototype.generateHtml.apply(this, arguments);
}


// -------------------------------------------------------------------------------------------------
// <a> class
// -------------------------------------------------------------------------------------------------

// Anchor constructor
function Anchor(parent, cid, vars, blankId)
{
	this.Base(parent, "a", cid, vars, blankId);
	
	if (!this.href)
		this.href = "#";
}

// Inherit from base HTML object
copyPrototype(Anchor, Base);


// -------------------------------------------------------------------------------------------------
// <table> class
// -------------------------------------------------------------------------------------------------

// Table constructor
function Table(parent, cid, vars, blankId)
{
	this.Base(parent, "table", cid, vars, blankId);
}

// Inherit from base HTML object
copyPrototype(Table, Base);


// -------------------------------------------------------------------------------------------------
// <tbody> class
// -------------------------------------------------------------------------------------------------

// Table Body constructor
function TableBody(parent, cid, vars, blankId)
{
	this.Base(parent, "tbody", cid, vars, blankId);
}

// Inherit from base HTML object
copyPrototype(TableBody, Base);


// -------------------------------------------------------------------------------------------------
// <thead> class
// -------------------------------------------------------------------------------------------------

// Table Body constructor
function TableHeader(parent, cid, vars, blankId)
{
	this.Base(parent, "thead", cid, vars, blankId);
}

// Inherit from base HTML object
copyPrototype(TableHeader, Base);


// -------------------------------------------------------------------------------------------------
// <tfoot> class
// -------------------------------------------------------------------------------------------------

// Table Body constructor
function TableFooter(parent, cid, vars, blankId)
{
	this.Base(parent, "tfoot", cid, vars, blankId);
}

// Inherit from base HTML object
copyPrototype(TableFooter, Base);


// -------------------------------------------------------------------------------------------------
// <tr> class
// -------------------------------------------------------------------------------------------------

// Table Row constructor
function TableRow(parent, cid, vars, blankId)
{
	this.Base(parent, "tr", cid, vars, blankId);
}

// Inherit from base HTML object
copyPrototype(TableRow, Base);


// -------------------------------------------------------------------------------------------------
// <td> class
// -------------------------------------------------------------------------------------------------

// Table Column constructor
function TableCol(parent, cid, vars, blankId)
{
	this.Base(parent, "td", cid, vars, blankId);
}

// Inherit from base HTML object
copyPrototype(TableCol, Base);


// -------------------------------------------------------------------------------------------------
// <form> class
// -------------------------------------------------------------------------------------------------

// Form constructor
function Form(parent, cid, vars, blankId)
{
	this.Base(parent, "form", cid, vars, blankId);
	
	if (!this.method)
		this.method = "post";
}

// Inherit from base HTML object
copyPrototype(Form, Base);


// -------------------------------------------------------------------------------------------------
// <input> class
// -------------------------------------------------------------------------------------------------

// Input constructor
function Input(parent, cid, vars, blankId)
{
	this.Base(parent, "input", cid, vars, blankId);
	
	if (!this.type)
		this.type = "text";

	if (cid && !this.name)
		this.name = cid;
}

// Inherit from base HTML object
copyPrototype(Input, Base);


// -------------------------------------------------------------------------------------------------
// <textarea> class
// -------------------------------------------------------------------------------------------------

// TextArea constructor
function TextArea(parent, cid, vars, blankId)
{
	this.Base(parent, "textarea", cid, vars, blankId);
	
	if (cid)
		this.name = cid;
}

// Inherit from base HTML object
copyPrototype(TextArea, Base);

// Overload generate function to ensure despite being empty both open and close tags are added, with no gap between
TextArea.prototype.generateHtml = function(intIndent)
{
	var strHtml, strIndent;
	
	if (!intIndent)
		intIndent = 0;
	strIndent = new Array(intIndent + 1).join(" ");
	
	strHtml = strIndent + "<" + this.data.tag;
	strHtml += this.argsString();	
	strHtml += ">";
	
	// Add content for this script if it exists
	if (this.data.content)
		strHtml += this.data.content;
	
	strHtml += "</" + this.data.tag + ">\n";
	
	return strHtml;
}

// -------------------------------------------------------------------------------------------------
// <label> class
// -------------------------------------------------------------------------------------------------

// Label constructor
function Label(parent, cid, vars, blankId)
{
	this.Base(parent, "label", cid, vars, blankId);
	
	if (cid)
		this.name = cid;
}

// Inherit from base HTML object
copyPrototype(Label, Base);


// -------------------------------------------------------------------------------------------------
// <select> class
// -------------------------------------------------------------------------------------------------

// Label constructor
function Select(parent, cid, vars, blankId)
{
	this.Base(parent, "select", cid, vars, blankId);
	
	if (cid)
		this.name = cid;
}

// Inherit from base HTML object
copyPrototype(Select, Base);


// -------------------------------------------------------------------------------------------------
// <option> class
// -------------------------------------------------------------------------------------------------

// Label constructor
function Option(parent, cid, vars, blankId)
{
	this.Base(parent, "option", cid, vars, blankId);
	
	if (cid)
		this.name = cid;
}

// Inherit from base HTML object
copyPrototype(Option, Base);


// -------------------------------------------------------------------------------------------------
// Placeholder class which contains objects but doesn't render tag surrounded content itself
// -------------------------------------------------------------------------------------------------

// Label constructor
function PlaceHolder(parent, cid, vars, blankId)
{
	this.Base(parent, "placeholder", cid, vars, blankId);

	if (cid)
		this.name = cid;
}

// Inherit from base HTML object
copyPrototype(PlaceHolder, Base);

// Converts this virtual HTML object to a string (but hides tags)
PlaceHolder.prototype.generateHtml = function(intIndent)
{
	var strHtml, strIndent, bolHasChildren;
	
	if (!intIndent)
		intIndent = 0;
	strIndent = new Array(intIndent + 1).join(" ");
	
	strHtml = "";	
	
	bolHasChildren = this.hasChildren();
	if (typeof(this.data.content) == "number")
		this.data.content = new String(this.data.content);
	
	if (this.data.content || bolHasChildren || (this.data.content === ""))
	{
		// Content always superceeds children, but may contain placeholders for children
		if (this.data.content)
		{
			if (bolHasChildren)
			{
				var self = this;
				strHtml += this.data.content.replace(reChildPlaceholder, function($0,$1) {
					if (self[$1] && (self[$1] != null))
						return self[$1].generateHtml(1);
					return $0;
				});
			}
			else
				strHtml += strIndent + this.data.content + "\n";
		}
		else if (bolHasChildren)
		{
			this.eachChild(function(obj) {
					strHtml += obj.generateHtml(intIndent + 1);
				});
		}
	}
	
	return strHtml;
}


// -------------------------------------------------------------------------------------------------
// <blockquote> class
// -------------------------------------------------------------------------------------------------

// BlockQuote constructor
function BlockQuote(parent, cid, vars, blankId)
{
	this.Base(parent, "blockquote", cid, vars, blankId);
}

// Inherit from base HTML object
copyPrototype(BlockQuote, Base);


// -------------------------------------------------------------------------------------------------
// <span> class
// -------------------------------------------------------------------------------------------------

// Span constructor
function Span(parent, cid, vars, blankId)
{
	this.Base(parent, "span", cid, vars, blankId);
}

// Inherit from base HTML object
copyPrototype(Span, Base);


// -------------------------------------------------------------------------------------------------
// <canvas> class
// -------------------------------------------------------------------------------------------------

// Canvas constructor
function Canvas(parent, cid, vars, blankId)
{
	this.width = 640;
	this.height = 480;
	
	this.Base(parent, "canvas", cid, vars, blankId);
	
	this.data.content = this.data.content || "Your browser does not appear to support HTML5 :(";
}

// Inherit from base HTML object
copyPrototype(Canvas, Base);


// -------------------------------------------------------------------------------------------------
// <button> class
// -------------------------------------------------------------------------------------------------

// Button constructor
function Button(parent, cid, vars, blankId)
{
	this.type = "button";
	
	this.Base(parent, "button", cid, vars, blankId);
}

// Inherit from base HTML object
copyPrototype(Button, Base);


// Now to export this mammoth class list
exports.Data = Data;
exports.Base = Base;
exports.Html = Html;
exports.xHtml = xHtml;
exports.Head = Head;
exports.Childless = Childless;
exports.Meta = Meta;
exports.Title = Title;
exports.Link = Link;
exports.StyleSheet = StyleSheet;
exports.RssFeed = RssFeed;
exports.Style = Style;
exports.Script = Script;
exports.Body = Body;
exports.Div = Div;
exports.Heading = Heading;
exports.Heading2 = Heading2;
exports.Heading3 = Heading3;
exports.Heading4 = Heading4;
exports.Heading5 = Heading5;
exports.Heading6 = Heading6;
exports.Paragraph = Paragraph;
exports.UnorderedList = UnorderedList;
exports.OrderedList = OrderedList;
exports.ListItem = ListItem;
exports.Image = Image;
exports.Anchor = Anchor;
exports.Table = Table;
exports.TableBody = TableBody;
exports.TableHeader = TableHeader;
exports.TableFooter = TableFooter;
exports.TableRow = TableRow;
exports.TableCol = TableCol;
exports.Form = Form;
exports.Input = Input;
exports.TextArea = TextArea;
exports.Label = Label;
exports.Select = Select;
exports.Option = Option;
exports.PlaceHolder = PlaceHolder;
exports.BlockQuote = BlockQuote;
exports.Span = Span;
exports.Canvas = Canvas;
exports.Button = Button;
