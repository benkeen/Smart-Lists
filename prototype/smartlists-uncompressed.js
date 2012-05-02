/**
 * Smart Lists
 * ~~~~~~~~~~~
 *
 * A Prototype/Scriptaculous extension that converts flat HTML lists of information into categorized,
 * paginated lists. This library is also available as a jQuery extension.
 *
 * @author  Ben Keen, http://www.benjaminkeen.com/software/smartlists/
 * @version 1.0.3
 * @date    June 8th 2008
 *
 *
 * Changelog
 * ~~~~~~~~~
 *
 * 1.0.3 - May 24 2008: second, optional pagination added, num results option, second dropdown added
 *         to allow cross-referencing display data.
 * 1.0.2 - Apr 17 2008: bug fix for flags with 2 or more words
 * 1.0.1 - Mar 21 2008: added itemChangeDuration option
 * 1.0.0 - Mar 8 2008: initial release
 */

var SmartList = Class.create();

SmartList.prototype = {
  currentPage:     1,
  currentFlag:     "dd1-all",
  currentFlag2:    "dd2-all",
  options:         {},   // stores all options defined for this Smart List
  flagInfo:        null, // stores all unique flags for this Smart List
  listItems:       [],   // stores the Smart List item nodes
  itemFlagIndexes: [],   // stores the flag indexes for each particular Smart List item
  hasSecondPagination: false,
  hasNumResults:       false,
  hasSecondDropdown:   false,

  initialize: function() {
    var options = Object.extend({
      baseName:                "sl",
      itemClass:               "item",
      showFlagCount:           true,
      itemFlagClass:           "flags",
      itemFlagSeparator:       ", ",
      itemChangeEffect:        "Blind", // "FadeAppear", "Blind", "ShrinkGrow", ""
      itemChangeDuration:      1,
      pageChangeEffect:        "FadeAppear", // "FadeAppear", "Blind", "ShrinkGrow", ""
      pageChangeDuration:      0.5,
      numItemsPerPage:         10,
      paginationLeft:          "\u00ab",
      paginationRight:         "\u00bb",
      maxPaginationLinks:      10,
      defaultDropdownOptText:  "All items",
      defaultDropdown2OptText: "All items",
      dd2Flags:                [],
      optgroups:               {}
    }, arguments[0] || {});

    // get all smart list item nodes
    var listItems = $$("#" + options.baseName + " ." + options.itemClass);
    var itemFlagIndexes = [];  // stores the flag indexes for each item
    var flagInfo = new Hash(); // flag string => [index, count]

    // if there's a second dropdown, make a note of it
    if ($(options.baseName + "-flag-dropdown2"))
      this.hasSecondDropdown = true;

    var currFlagIndex = 0;
    for (var i=0; i<listItems.length; i++)
    {
      // only display the first page; hide the rest
      listItems[i].style.display = (i < options.numItemsPerPage) ? "block" : "none";

      // each Smart List item can contain multiple flag sections
      var itemFlagNodes = $(listItems[i]).select("." + options.itemFlagClass);
      var currItemFlagIndexes = [];
      var linkNodes = [];

      for (var j=0; j<itemFlagNodes.length; j++)
      {
        var currItemFlagStrings = $(itemFlagNodes[j]).innerHTML.split(/\s+/);
        var flagSpan = document.createElement("span");

        // convert each flag to a Smart List link and while we're at it, keep track of all unique flags
        for (var k=0; k<currItemFlagStrings.length; k++)
        {
          // replace any non-breaking spaces with spaces
          var currFlag = currItemFlagStrings[k].replace(/&nbsp;/g, " ");
          var ddNum = (this.hasSecondDropdown && options.dd2Flags.include(currFlag)) ? 2 : 1;

          flagIndex = currFlagIndex;
          if (flagInfo.get(currFlag) == undefined)
          {
            flagInfo.set(currFlag, [currFlagIndex, 1, ddNum]);
            currFlagIndex++;
          }

          // this flag has already been added. Update the flag count and retrieve the flag index
          else
          {
            var oldFlagInfo = flagInfo.get(currFlag);
            flagIndex = oldFlagInfo[0];
            flagCount = oldFlagInfo[1] + 1;
            flagInfo.set(currFlag, [flagIndex, flagCount, ddNum]);
          }

          var a = $(document.createElement("a"));
          a.setAttribute("href", "#");
          a.addClassName(options.baseName + "-flag" + flagIndex);
          a.appendChild(document.createTextNode(currFlag));
          flagSpan.appendChild(a);
          flagSpan.appendChild(document.createTextNode(options.itemFlagSeparator));
          currItemFlagIndexes.push(flagIndex);
        }

        // now remove the content of this flag node and insert the flag links
        $(itemFlagNodes[j]).innerHTML = "";
        $(itemFlagNodes[j]).appendChild(flagSpan);
      }

      // remove the last comma
      if (flagSpan.childNodes.length)
        flagSpan.removeChild(flagSpan.childNodes[flagSpan.childNodes.length-1]);

      // keep track of all flag indexes for this item
      itemFlagIndexes[i] = currItemFlagIndexes;
    }

    // sort the Hash
    var sorted = flagInfo.keys().sort();
    var sortedFlagInfo = new Hash();

    for (var i=0; i<sorted.length; i++)
    {
      var value = flagInfo.get(sorted[i]);
      sortedFlagInfo.set(sorted[i], value);
    }

    // if there's a second pagination node to fill, make a note of it
    if ($(options.baseName + "-pagination2"))
      this.hasSecondPagination = true;

    if ($(options.baseName + "-num-results"))
    {
      this.hasNumResults = true;
      $(options.baseName + "-num-results").innerHTML = listItems.length;
    }

    // store the various settings of this Smart List for later use
    this.options = options;
    this.flagInfo = sortedFlagInfo;
    this.listItems = listItems;
    this.itemFlagIndexes = itemFlagIndexes;

    // prep the other aspects of the Smart List
    this.createPagination("dd1-all");
    this.addDropdowns();

    // show the entire Smart List (in case it was hidden)
    $(options.baseName).show();
  },


  /**
   * Called on initialization and whenever the user selects a flag. It re-creates the navigation
   * with the appropriate pagination links. If a second pagination item exists, it creates that one
   * too.
   */
  createPagination: function()
  {
    this._createPaginationGroup("pagination");
    if (this.hasSecondPagination)
      this._createPaginationGroup("pagination2");
  },


  /**
   * For use by calling page.
   */
  showAll: function()
  {
    this.currentFlag  = "dd1-all";
    this.currentFlag2 = "dd2-all";
    this.filterByFlag(null, "dd1-all");

    if (this.hasSecondDropdown)
      this._selectDropdownOption("dd2-all", 2);
  },


  /**
   * Called on Smart List initialization; creates the sorted dropdown contents. With 1.0.3, you
   * can now define TWO dropdowns, if you need to categorize content in two ways.
   */
  addDropdowns: function()
  {
    var options  = this.options;
    var flagInfo = this.flagInfo;
    var hasSecondDropdown = this.hasSecondDropdown;
    var currSmartList = this;

    // build the first dropdown
    var s = document.createElement("select");
    s.onchange = this.filterByFlag.bindAsEventListener(this);
    var defaultOpt = document.createElement("option");
    defaultOpt.setAttribute("value", "dd1-all");
    defaultOpt.appendChild(document.createTextNode(options.defaultDropdownOptText));
    s.appendChild(defaultOpt);

    flagInfo.each(function(pair) {
      var flag  = pair.key;
      var index = pair.value[0];
      var count = pair.value[1];
      var ddNum = pair.value[2];

      if (ddNum == 1)
      {
	      var opt = document.createElement("option");
	      opt.setAttribute("value", index);
	      var displayText = (options.showFlagCount) ? flag + " (" + count + ")" : flag;
	      opt.appendChild(document.createTextNode(displayText));
	      s.appendChild(opt);
      }

	    $$("." + options.baseName + "-flag" + index).invoke('observe', 'click',
	      currSmartList.filterByFlag.bindAsEventListener(currSmartList, index));
    });

    $(options.baseName + "-flag-dropdown").appendChild(s);


    // if needed, create a second dropdown
    if (hasSecondDropdown)
    {
	    var s = document.createElement("select");
	    s.onchange = this.filterByFlag.bindAsEventListener(this);
	    var defaultOpt = document.createElement("option");
	    defaultOpt.setAttribute("value", "dd2-all");
	    defaultOpt.appendChild(document.createTextNode(options.defaultDropdown2OptText));
	    s.appendChild(defaultOpt);

	    flagInfo.each(function(pair) {
	      var flag  = pair.key;
	      var index = pair.value[0];
	      var count = pair.value[1];
	      var ddNum = pair.value[2];

	      if (ddNum == 2)
	      {
		      var opt = document.createElement("option");
		      opt.setAttribute("value", index);
		      var displayText = (options.showFlagCount) ? flag + " (" + count + ")" : flag;
		      opt.appendChild(document.createTextNode(displayText));
		      s.appendChild(opt);
	      }
	    });

	    $(options.baseName + "-flag-dropdown2").appendChild(s);
    }
  },


  /**
   * Called whenever the user selects a flag by clicking on its link, or selecting it from the dropdown
   * list. This function filters all the Smart List items by the selected flag, re-selects the appropriate
   * value in the dropdown list and updates the pagination. The flag index is passed in one of two ways: through
   * the second parameter, or by tracking the event's source element and grabbing its value (with the dropdown).
   *
   * With 1.0.3, there are now two dropdowns, meaning that the user can filter the results by TWO flags simultaneously.
   * The upshot of this is that there may be no results returned.
   */
  filterByFlag: function(event, index) {

    var flagIndex = index;
    if (event != null && Event.element(event).value != undefined)
      flagIndex = Event.element(event).value;

    if (event != null)
      Event.stop(event);

    // find out which dropdown this flag belongs to
    var ddNum = this._getFlagDropdownNum(flagIndex);

    // keep track of which dropdown has which selected value
    if (ddNum == 1)
      this.currentFlag = flagIndex;
    else
      this.currentFlag2 = flagIndex;

    var listItems = this.listItems;
    var options   = this.options;
    var itemFlagIndexes = this.itemFlagIndexes;

    // loop through the list items and display the first page
    var count = 0;
    for (var i=0; i<listItems.length; i++)
    {
      // once the first page is full, hide all remaining items
      if (count >= options.numItemsPerPage)
      {
        listItems[i].hide();
        continue;
      }

      if (this._shouldDisplayItem(itemFlagIndexes[i]))
      {
        if (listItems[i].style.display == "none")
        {
          switch (options.itemChangeEffect)
          {
            case "Blind":
              Effect.BlindDown(listItems[i], { duration: options.itemChangeDuration } );
              break;
            case "FadeAppear":
              Effect.Appear(listItems[i], { duration: options.itemChangeDuration });
              break;
            case "ShrinkGrow":
              Effect.Grow(listItems[i], { duration: options.itemChangeDuration });
              break;

            default:
              listItems[i].show();
              break;
          }
        }
        count++;
      }
      else
      {
        if (listItems[i].style.display != "none")
        {
          switch (options.itemChangeEffect)
          {
            case "Blind":
              Effect.BlindUp(listItems[i], { duration: options.itemChangeDuration });
              break;
            case "FadeAppear":
              Effect.Fade(listItems[i], { duration: options.itemChangeDuration });
              break;
            case "ShrinkGrow":
              Effect.Shrink(listItems[i], { duration: options.itemChangeDuration });
              break;
            default:
              listItems[i].hide();
              break;
          }
        }
        else
          listItems[i].hide();
      }
    }

    if (this.hasNumResults)
    {
      var numResults = this._getNumItemsByFlag();
      $(options.baseName + "-num-results").innerHTML = numResults;

      if (numResults == 0)
      {
        if ($(options.baseName + "-no-results").style.display == "none" || $(options.baseName + "-no-results").style.display == "")
        {
          Effect.Appear($(options.baseName + "-no-results"), { duration: options.itemChangeDuration, delay: options.itemChangeDuration });
        }
      }
      else
      {
        if ($(options.baseName + "-no-results").style.display == "block" || $(options.baseName + "-no-results").style.display == "")
          Effect.Fade($(options.baseName + "-no-results"), { duration: options.itemChangeDuration });
      }
    }

    this._selectDropdownOption(flagIndex, ddNum);
    this.createPagination(flagIndex);
    this.currentPage = 1;
  },


  /**
   * Called whenever the user clicks on a new nav page.
   */
  changePage: function(event, page) {
    var options     = this.options;
    var currentPage = this.currentPage;

    if (page == currentPage)
      return;

    if (page == "next")
      page = currentPage + 1;
    else if (page == "previous")
      page = currentPage - 1;

    // find out which items are to be displayed.
    var selectedFlagItems = this._getItemsByFlag();

    // update the pagination(s)
    this._updatePaginationGroup("pagination", selectedFlagItems, page);
    if (this.hasSecondPagination)
      this._updatePaginationGroup("pagination2", selectedFlagItems, page);

    if (this.hasNumResults)
      $(options.baseName + "-num-results").innerHTML = selectedFlagItems.length;

    var firstItemToHide = (currentPage - 1) * options.numItemsPerPage;
    var maxLastItem     = firstItemToHide + options.numItemsPerPage;
    var lastItemToHide  = (maxLastItem > selectedFlagItems.length) ? selectedFlagItems.length : maxLastItem;

    var firstItemToShow = (page - 1) * options.numItemsPerPage;
    var maxLastItem     = firstItemToShow + options.numItemsPerPage;
    var lastItemToShow  = (maxLastItem > selectedFlagItems.length) ? selectedFlagItems.length : maxLastItem;

    for (var i=0; i<selectedFlagItems.length; i++)
    {
      if (i >= firstItemToHide && i < lastItemToHide)
      {
        switch (options.pageChangeEffect)
        {
          case "Blind":
            Effect.BlindUp(selectedFlagItems[i], { duration: options.pageChangeDuration });
            break;
          case "FadeAppear":
            Effect.Fade(selectedFlagItems[i], { duration: options.pageChangeDuration });
            break;
          case "ShrinkGrow":
            Effect.Shrink(selectedFlagItems[i], { duration: options.pageChangeDuration });
            break;
          default:
            $(selectedFlagItems[i]).hide();
            break;
        }
      }
      if (i >= firstItemToShow && i < lastItemToShow)
      {
        switch (options.pageChangeEffect)
        {
          case "Blind":
            Effect.BlindDown(selectedFlagItems[i], { delay: options.pageChangeDuration, duration: options.pageChangeDuration });
            break;
          case "FadeAppear":
            Effect.Appear(selectedFlagItems[i], { delay: options.pageChangeDuration, duration: options.pageChangeDuration });
            break;
          case "ShrinkGrow":
            Effect.Grow(selectedFlagItems[i], { delay: options.pageChangeDuration, duration: options.pageChangeDuration });
            break;
          default:
            $(selectedFlagItems[i]).show();
            break;
        }
      }
    }

    this.currentPage = page;

    Event.stop(event);
  },


  _createPaginationGroup: function(cssLabel)
  {
    var listItems = this.listItems;
    var options   = this.options;
    var flagInfo  = this.flagInfo;
		var flagCount = this._getNumItemsByFlag();
		var numPages = Math.ceil(flagCount / options.numItemsPerPage);

    $(options.baseName + "-" + cssLabel).innerHTML = "";
    if (numPages <= 1)
      return;

    var pagination = document.createElement("span");

    var previousSpan = document.createElement("span");
    previousSpan.setAttribute("id", options.baseName + "-" + cssLabel + "-previous");
    previousSpan.appendChild(document.createTextNode(this.options.paginationLeft));
    pagination.appendChild(previousSpan);

    var halfTotalNavPages = Math.floor(options.maxPaginationLinks / 2);

    for (var i=1; i<=numPages; i++)
    {
      var span = document.createElement("span");
      span.setAttribute("id", options.baseName + "-" + cssLabel + "-page" + i);

      if (i == 1)
      {
        span.setAttribute("class", options.baseName + "-" + cssLabel + "-selected");
        span.setAttribute("className", options.baseName + "-" + cssLabel + "-selected");
      }

      if (i > halfTotalNavPages)
        span.style.cssText = "display:none";

      var a = document.createElement("a");
      a.setAttribute("href", "#");
      a.onclick = this.changePage.bindAsEventListener(this, i);
      a.appendChild(document.createTextNode(i));
      span.appendChild(a);

      pagination.appendChild(span);
    }

    var nextSpan = document.createElement("span");
    nextSpan.setAttribute("id", options.baseName + "-" + cssLabel + "-next");
    nextSpan.appendChild(this._getPaginationNextLinkNode());
    pagination.appendChild(nextSpan);

    $(options.baseName + "-" + cssLabel).appendChild(pagination);
  },


  _updatePaginationGroup: function(cssLabel, selectedFlagItems, page)
  {
    var options = this.options;
    var currentPage = this.currentPage;

    $(options.baseName + "-" + cssLabel + "-page" + currentPage).removeClassName(options.baseName + "-" + cssLabel + "-selected");
    $(options.baseName + "-" + cssLabel + "-page" + page).addClassName(options.baseName + "-" + cssLabel + "-selected");

    // lastly, update the pagination links
    var lastPage = Math.ceil(selectedFlagItems.length / options.numItemsPerPage);
    if (page == 1)
      $(options.baseName + "-" + cssLabel + "-previous").innerHTML = options.paginationLeft;
    else
    {
      $(options.baseName + "-" + cssLabel + "-previous").innerHTML = "";
      $(options.baseName + "-" + cssLabel + "-previous").appendChild(this._getPaginationPreviousLinkNode());
    }

    if (page == lastPage)
      $(options.baseName + "-" + cssLabel + "-next").innerHTML = options.paginationRight;
    else
    {
      $(options.baseName + "-" + cssLabel + "-next").innerHTML = "";
      $(options.baseName + "-" + cssLabel + "-next").appendChild(this._getPaginationNextLinkNode());
    }

    // only show the appropriate navigation links (max: options.maxPaginationLinks)
    var totalVisible = 0;
    var halfTotalNavPages = Math.floor(options.maxPaginationLinks / 2);
    var firstVisiblePage  = (page > halfTotalNavPages) ? page - halfTotalNavPages : 1;
    var lastVisiblePage   = ((page + halfTotalNavPages) < lastPage) ? page + halfTotalNavPages : lastPage;

    for (var i=1; i<=lastPage; i++)
    {
      if (i < firstVisiblePage)
        $(options.baseName + "-" + cssLabel + "-page" + i).hide();
      if (i > lastVisiblePage)
        $(options.baseName + "-" + cssLabel + "-page" + i).hide();

      if (i >= firstVisiblePage && i <= lastVisiblePage)
        $(options.baseName + "-" + cssLabel + "-page" + i).show();
    }
  },

  _getFlagCountFromFlagIndex: function(flagIndex)
  {
    var flagCount = null;
    this.flagInfo.each(function(pair) {
      var key   = pair.key;
      var value = pair.value;

      if (flagIndex == value[0])
        flagCount = value[1];
    });

    return flagCount;
  },


  /**
   * This returns all smart list items that have BOTH flag indexes selected (if 2 dropdowns) or
   * the one flag index (if only one dropdown).
   */
  _getItemsByFlag: function()
  {
    var flagIndex  = this.currentFlag;
    var flagIndex2 = this.currentFlag2;

    var nodes = [];
    for (var i=0; i<this.listItems.length; i++)
    {
      var inFirstDropdown = false;
      if (this.itemFlagIndexes[i].include(flagIndex) || flagIndex == "dd1-all")
        inFirstDropdown = true;

      var inSecondDropdown = true;
      if (this.hasSecondDropdown)
      {
        if (!this.itemFlagIndexes[i].include(flagIndex2) && flagIndex2 != "dd2-all")
          inSecondDropdown = false;
      }

      if (inFirstDropdown && inSecondDropdown)
        nodes.push(this.listItems[i]);
    }

    return nodes;
  },

  // calculates the total # results to display based on the current values in this.currentFlag and
  // this.currentFlag2
  _getNumItemsByFlag: function()
  {
    return this._getItemsByFlag().length;
  },

  _getPaginationNextLinkNode: function()
  {
    var nextLink = document.createElement("a");
    nextLink.setAttribute("href", "#");
    nextLink.onclick = this.changePage.bindAsEventListener(this, "next");
    nextLink.appendChild(document.createTextNode(this.options.paginationRight));

    return nextLink;
  },

  _getPaginationPreviousLinkNode: function()
  {
    var previousLink = document.createElement("a");
    previousLink.setAttribute("href", "#");
    previousLink.onclick = this.changePage.bindAsEventListener(this, "previous");
    var left = this.options.paginationLeft;
    previousLink.appendChild(document.createTextNode(left));

    return previousLink;
  },


  _selectDropdownOption: function(flagIndex, ddNum)
  {
    var cssLabel = (ddNum == 1) ? "dropdown" : "dropdown2";
    var options = this.options;

    var dd_div = $(options.baseName + "-flag-" + cssLabel).getElementsByTagName("select");
    var dd = dd_div[0];
    for (var i=0; i<dd.options.length; i++)
    {
      if (dd.options[i].value == flagIndex)
      {
        dd.options[i].selected = true;
        break;
      }
    }
  },

  _getFlagDropdownNum: function(flagIndex)
  {
    var ddNum = 1;
    if (this.hasSecondDropdown)
    {
      if (flagIndex == "dd2-all")
        ddNum = 2;

	    this.flagInfo.each(function(pair) {
	      var index = pair.value[0];
	      if (index == flagIndex)
	        ddNum = pair.value[2];
	    });
    }

    return ddNum;
  },


  // figures out whether an item should be displayed based on the contents of this.currentFlag and
  // this.currentFlag2
  _shouldDisplayItem: function(flagIndexes)
  {
    var shouldDisplay = false;
    if (flagIndexes.include(this.currentFlag) || this.currentFlag == "dd1-all")
    {
      shouldDisplay = true;

      if (this.hasSecondDropdown)
      {
        shouldDisplay = false;
        if (flagIndexes.include(this.currentFlag2) || this.currentFlag2 == "dd2-all")
          shouldDisplay = true;
      }
    }

    return shouldDisplay;
  }
};