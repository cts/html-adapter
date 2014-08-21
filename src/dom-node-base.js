CTS.registerNamespace('CTS.Adapters.Html');

CTS.Adapters.Html.HtmlNodeBase = {
  debugName: function() {
    return CTS.Fn.map(this.siblings, function(node) {
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
    return CTS.Util.getTreesheetLinks(this.value);
  },

  // Horrendously inefficient.
  find: function(selector, ret) {
    if (typeof ret == 'undefined') {
      ret = [];
    }
    if (this.value.is(selector)) {
      if (typeof ret == 'undefined') {
        CTS.Log.Error("push");
      }
      ret.push(this);
    }
    for (var i = 0; i < this.children.length; i++) {
      if (this.children[i] == null) {
        CTS.Log.Error("Error: Child " + i + " of me is null (find:" + selector + ")", this);
      } else {
        if (typeof this.children[i] == 'undefined') {
          CTS.Log.Error("Undefined child");
        }
        this.children[i].find(selector, ret);
      }
    }
    return ret;
  },

  _subclass_beginClone_base: function($node, klass) {
    var d = CTS.Promise.defer();
    var $value = null;
    if (typeof $node == "undefined") {
      $value = this.value.clone();
    } else {
      $value = $node;
    }

    // Remove any inline CTS annotations, since we're going to
    // manually copy in relations.
    $value.attr('data-cts', null);
    $value.find("*").attr('data-cts', null);

    // NOTE: beginClone is allowed to directly create a Node
    // without going through the factory because we already can be
    // sure that all this node's trees have been realized
    var clone = new klass($value, this.tree, this.opts);
    var cloneKids = clone.value.children();

    if (this.children.length != cloneKids.length) {
      CTS.Log.Error("Trying to clone CTS node that is out of sync with dom");
    }
    // We use THIS to set i
    var kidPromises = [];
    for (var i = 0; i < cloneKids.length; i++) {
      var $child = CTS.$(cloneKids[i]);
      kidPromises.push(this.children[i]._subclass_beginClone($child));
    }

    if (kidPromises.length == 0) {
      d.resolve(clone);
    } else {
      CTS.Promise.all(kidPromises).then(
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
    var spec = CTS.Parser.parseSheetSelector(s);
    if (! spec.tree) {
      s = 'sheet | ' + s;
    }

    if (attr == 'connect') {
      // ARE
      if (((spec.projection == 'Rows') && (! spec.row)) ||
          ((spec.projection == 'Cols') && (! spec.col))) {
        if (this.value.is("form")) {
            return "this :graft " + s + ' {"createNew": "true"};';
          } else {
            return "this :are " + s + ";";
          }
      } else if (this.value.closest('form').length > 0) {
        return s + " :is this;";
      } else {
        return "this :is " + s + ';';
      }
    } else if (attr == 'show-if') {
      return "this :if-exist " + s + ';';
    } else if (attr == 'hide-if') {
      return "this :if-nexist " + s + ';';
    }
  },

  _subclass_getInlineRelationSpecString: function() {
    if (this.value !== null) {
      var inline;
      if (inline = this.value.attr('data-cts')) {
        return inline;
      } else if (inline = this.value.attr('connect')) {
        return this._rewriteQuiltVariant('connect', inline);
      } else if (inline = this.value.attr('show-if')) {
        return this._rewriteQuiltVariant('show-if', inline);
      } else if (inline = this.value.attr('hide-if')) {
        return this._rewriteQuiltVariant('hide-if', inline);
      }
    }
    return null;
  },

  hide: function() {
    this.value.hide();
  },

  unhide: function() {
    this.value.show();
  },

  _subclass_ensure_childless: function() {
    if (this.value !== null) {
      this.value.html("");
    }
  }
};
