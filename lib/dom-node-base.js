var Util = require('cts/util');
var Model = require('cts/model');

var HtmlNodeBase = {
  debugName: function() {
    return Util._.map(this.siblings, function(node) {
      return node[0].nodeName; }
    ).join(', ');
  },

  stash: function() {
    this.value.attr('data-ctsid', this.ctsId);
    this.tree.nodeStash[this.ctsId] = this;
  },

  _subclass_shouldRunCtsOnInsertion: function() {
    if (! this.value) return false;
    if (this.value.hasClass('cts-ignore')) return false;
  },

  _subclass_getTreesheetLinks: function() {
    return Util.Helper.getTreesheetLinks(this.value);
  },

  _subclass_removeChild: function(node, index) {
    node.value.detach();
  },

  // Horrendously inefficient.
  find: function(selector, ret) {
    if (typeof ret == 'undefined') {
      ret = [];
    }
    if (this.value.is(selector)) {
      if (typeof ret == 'undefined') {
        Util.Log.Error("push");
      }
      ret.push(this);
    }
    for (var i = 0; i < this.children.length; i++) {
      if (this.children[i] == null) {
        Util.Log.Error("Error: Child " + i + " of me is null (find:" + selector + ")", this);
      } else {
        if (typeof this.children[i] == 'undefined') {
          Util.Log.Error("Undefined child");
        }
        this.children[i].find(selector, ret);
      }
    }
    return ret;
  },

  _subclass_transformStateChanged: function(transform) {
    var whichNode = this;

    if (transform.operation == 'node-inserted') {
      if (transform.value && transform.value.value) {
        whichNode = transform.value;
      }
    }

    if (transform.state == 'pending') {
      whichNode.value.addClass('cs-saving');
      whichNode.value.removeClass('cs-save-failed');
      whichNode.value.removeClass('cs-save-succeeded');
      whichNode.value.attr('disabled', true);
    } else if (transform.state == 'success') {
      whichNode.value.removeClass('cs-saving');
      whichNode.value.removeClass('cs-save-failed');
      whichNode.value.addClass('cs-save-succeeded');
      whichNode.value.attr('disabled', false);
      setTimeout(function() {
        whichNode.value.removeClass('cs-save-succeeded');
      }, 1000);
    } else if (transform.state == 'failed') {
      whichNode.value.addClass('cs-save-failed');
      whichNode.value.removeClass('cs-saving');
      whichNode.value.removeClass('cs-save-succeeded');
      whichNode.value.attr('disabled', false);
    }
  },

  _subclass_beginClone_base: function($node, klass) {
    var d = Util.Promise.defer();
    var $value = null;
    if (typeof $node == "undefined") {
      $value = this.value.clone();
    } else {
      $value = $node;
    }

    // Remove any inline CTS annotations, since we're going to
    // manually copy in relations.

    // NOTE: beginClone is allowed to directly create a Node
    // without going through the factory because we already can be
    // sure that all this node's trees have been realized



    var clone = new klass($value, this.tree, this.opts);
    var self = this;
    clone.parseInlineRelationSpecs().then(
      function(spec) {
        if (spec) {
          Util.Log.Info("Found clone spec", spec);
        }

        var cloneKids = clone.value.children();

        if (self.children.length != cloneKids.length) {
          Util.Log.Error("Trying to clone CTS node that is out of sync with dom");
        }
        // We use THIS to set i
        var kidPromises = [];
        for (var i = 0; i < cloneKids.length; i++) {
          var $child = Util.$(cloneKids[i]);
          kidPromises.push(self.children[i]._subclass_beginClone($child));
        }

        if (kidPromises.length == 0) {
          d.resolve(clone);
        } else {
          Util.Promise.all(kidPromises).then(
            function(kids) {
              for (var i = 0; i < kids.length; i++) {
                kids[i].parentNode = clone;
                clone.children.push(kids[i]);
              }
              d.resolve(clone);
            },
            function(reason) {
              d.reject(reason);
            }
          );
        }

      },
      function(reason) {
        deferred.reject(reason);
      }
    );


    return d.promise;
  },


  /*
   *  Removes this DOM node from the DOM tree it is in.
   */
  _subclass_destroy: function() {
    this.value.remove();
  },

  _fixSpreadSheetRef: function(ref) {
    var match;
    if (match = this._rSheetRef.exec(ref)) {
      return ref;
    } else {
      return "sheet | " + ref;
    }
  },

  _rewriteQuiltVariant: function(attr, s) {
    var partsR = /^\s*([^\}]*)\s*(\{.*\})\s*$/;
    var origAttr = s;
    
    var match;
    var opts = {};
    if (match = partsR.exec(s)) {
      console.log(match);
      s = match[1];
      opts = JSON.parse(match[2]);
    }

    var spec = Model.Factory.SelectionSpec('gsheet', s);

    var defaultSheetName = 'sheet';
    var lastGSheet = null;
    var lastOther = null;
    if (CTS && CTS.engine && CTS.engine.forrest && CTS.engine.forrest.treeSpecs) {
      for (var label in CTS.engine.forrest.treeSpecs) {
        if (label != 'body') {
          var spec = CTS.engine.forrest.treeSpecs[label];
          if (spec && spec.kind && (spec.kind == 'gsheet')) {
            lastGSheet = label;
          } else {
            lastOther = label;
          }
        }
      }
    }

    if (lastOther != null) {
      defaultSheetName = lastOther;
    }
    if (lastGSheet != null) {
      defaultSheetName = lastGSheet;
    }
    
    if (! spec.tree) {
      s = defaultSheetName + ' | ' + s;
    }

    if (attr == 'connect') {
      // ARE
      if (((spec.projection == 'Rows') && (! spec.row)) ||
          ((spec.projection == 'Cols') && (! spec.col))) {
      }
    }

    opts = JSON.stringify(opts);

    if (attr == 'connect') {
      // ARE
      if (((spec.projection == 'Rows') && (! spec.row)) ||
          ((spec.projection == 'Cols') && (! spec.col))) {
        if (spec.property) {
          return "this :is " + s + ' ' + opts + ';';
        } else if (this.value.is("form")) {
          return "this :creates " + s + ' ' + opts + ';';
        } else {
          return "this :are " + s + " " + opts + ";";
        }
      } else if (this.value.closest('form').length > 0) {
        return s + " " + opts + " :is this;";
      } else {
        return "this :is " + s + ' ' + opts + ';';
      }
    } else if (attr == 'show-if') {
      return "this :if-exist " + s + ' ' + opts + ';';
    } else if (attr == 'hide-if') {
      return "this :if-nexist " + s + ' ' + opts + ';';
    } else if (attr == 'updates') {
      var dict = {
        with: this.value.attr('updates-with'),
        on: this.value.attr('updates-on')
      };
      var dictStr = JSON.stringify(dict);
      return "this " + dictStr + " :updates " + s + ";";
    } else if (match = this._connectRegex.exec(attr)) {
      var attribute = match[1];
      return 'this {"attribute": "' + attribute + '"} :is ' + s + ' ' + opts + ';';
    } else if (attr == 'widget') {
      var cts = '@cts ' + 'http://apps.cloudstitch.io/' + origAttr + '/treesheet.cts;';
      return cts;
    }
  },

  _connectRegex: /^connect-(.+)$/,

  _subclass_getInlineRelationSpecString: function() {

    if (this.value !== null) {
      var inline;
      var thects = '';
      if (inline = this.value.attr('data-cts')) {
        thects += inline;
      } else {
        if (inline = this.value.attr('connect')) {
          thects += this._rewriteQuiltVariant('connect', inline);
        }
        if (inline = this.value.attr('connect-class')) {
          thects += this._rewriteQuiltVariant('connect-class', inline);
        }
        if (inline = this.value.attr('connect-href')) {
          thects += this._rewriteQuiltVariant('connect-href', inline);
        }
        if (inline = this.value.attr('connect-src')) {
          thects += this._rewriteQuiltVariant('connect-src', inline);
        }
        if (inline = this.value.attr('connect-id')) {
          thects += this._rewriteQuiltVariant('connect-id', inline);
        }
        if (inline = this.value.attr('show-if')) {
          thects += this._rewriteQuiltVariant('show-if', inline);
        }
        if (inline = this.value.attr('hide-if')) {
          thects += this._rewriteQuiltVariant('hide-if', inline);
        }
        if (inline = this.value.attr('updates')) {
          thects += this._rewriteQuiltVariant('updates', inline);        
        }
        if (inline = this.value.attr('widget')) {
          thects += this._rewriteQuiltVariant('widget', inline);        
        }
      }
      if (thects.length > 0) {
        return thects;
      }
    }
    return null;
  },

  setVisibility: function(val, opts, relation) {
    if (val) {
      if (Util._.isUndefined(opts) || Util._.isUndefined(opts.attribute)) {
        this.value.show();
      } else {
        if (this.value.attr('cts-hidden-' + opts.attribute)) {
          this.value.attr(opts.attribute, this.value.attr('cts-hidden-' + opts.attribute));
        }
      }
    } else {
      if (Util._.isUndefined(opts) || Util._.isUndefined(opts.attribute)) {
        this.value.hide();
      } else {
        this.value.attr('cts-hidden-' + opts.attribute, this.value.attr(opts.attribute));   
        this.value.attr(opts.attribute, null);
      }
    }
  },

  _subclass_ensure_childless: function() {
    if (this.value !== null) {
      this.value.html("");
    }
  }
};

module.exports = HtmlNodeBase;
