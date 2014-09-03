var HtmlNodeBase = require('./dom-node-base');
var Util = require('cts/util');
var Model = require('cts/model');

function CreateHtmlNode(node, tree, opts) {
  var deferred = Util.Promise.defer();
  var klass = HtmlNode;

  if (! Util._.isUndefined(node.jquery)) {
    if (node.is('input') || node.is('select')) {
      klass = HtmlInputNode;
    }
  } else if (node instanceof Element) {
    if ((node.nodeName == 'INPUT') || (node.nodeName == 'SELECT')) {
      klass = HtmlInputNode;
    }
  }

  var node = new klass(node, tree, opts);
  node.parseInlineRelationSpecs().then(
    function() {
      if (node == null) {
        Util.Log.Error("Created NULL child");
      }
      deferred.resolve(node);
    },
    function(reason) {
      deferred.reject(reason);
    }
  );
  return deferred.promise;
};

// ### Constructor
function HtmlNode(node, tree, opts) {
  opts = opts || {};
  this.initializeNodeBase(tree, opts);
  this.kind = "HTML";
  this.value = Util.Helper.createJqueryNode(node);
  this.value.data('ctsnode', this);
  this.ctsId = Util._.uniqueId().toString();

  this.value.data('ctsid', this.ctsId);
  this.value.data('ctsnode', this);

  this.shouldReceiveEvents = true;
  this.shouldThrowEvents = true;

  this.on('received-is', function() {
    this.value.trigger('cts-received-is');
  });
};

// ### Instance Methods
Util._.extend(HtmlNode.prototype, Model.Node.Base, Util.Events, HtmlNodeBase, {

   /*
    * Precondition: this.children.length == 0
    *
    * Realizes all children.
    */
   _subclass_realizeChildren: function() {
     // promise
     var deferred = Util.Promise.defer();

     this.children = [];

     // Map each child

     var self = this;
     var promises = Util._.map(this.value.children(), function(child) {
       var promise = CreateHtmlNode(child, self.tree, self.opts);
       return promise;
     });

     Util.Promise.all(promises).then(
       function(results) {
         self.children = results;
         for (var i = 0; i < self.children.length; i++) {
           var node = self.children[i];
           if ((typeof node == "undefined") || (node == null)) {
             Util.Log.Error("Child is undefined or null!");
           }
           node.parentNode = self;
         }
         deferred.resolve();
       },
       function(reason) {
         deferred.reject(reason);
       }
     );

     return deferred.promise;
   },

   /*
    * Inserts this DOM node after the child at the specified index.
    */
   _subclass_insertChild: function(child, afterIndex) {
     if (afterIndex == -1) {
       if (this.getChildren().length == 0) {
         this.value.append(child.value);
       } else {
         this.value.prepend(child.value)
       }
     } else if (afterIndex > -1) {
       var leftSibling = this.getChildren()[afterIndex];
       leftSibling.value.after(child.value);
     } else {
       Util.Log.Error("[HTML Node] Afer index shouldn't be ", afterIndex);
     }
   },

   /*
    *
    * Args:
    *   child: A jQuery node
    *
    * TODO(eob(): Implement some kind of locking here?
    */
   _onChildInserted: function(child) {
     var self = this;
     CreateHtmlNode(child, this.tree, this.opts).then(
       function(ctsChild) {
         ctsChild.parentNode = self;
         var idx = child.index();
         var l = self.children.length;
         self.children[self.children.length] = null;
         // TODO: need locking on kids
         for (var i = self.children.length - 1; i >= idx; i--) {
           if (i == idx) {
             self.children[i] = ctsChild;
           } else {
             self.children[i] = self.children[i - 1];
           }
         }
         // XXX TODO: This is a hack case that happens when CTS indexing and DOM indexing get out of sync
         // because of cts-ignore nodes. Need to figure out how to fix.
         if ((self.children[self.children.length - 1] == null) && (idx >= self.children.length)) {
           self.children[self.children.length - 1] = ctsChild;
         }

         ctsChild.realizeChildren().then(
           function() {
             //  Now run any rules.
             Util.Log.Info("Running CTS Rules on new node");
             ctsChild._processIncoming().done();
           },
           function(reason) {
             Util.Log.Error("Could not realize children of new CTS node", ctsChild);
           }
         ).done();
       },
       function(reason) {
         Util.Log.Error("Could not convert new node to CTS node", child, reason);
       }
     ).done();
   },

   _subclass_beginClone: function($node) {
     return this._subclass_beginClone_base($node, HtmlNode);
   },

  /************************************************************************
   **
   ** Required by Relation classes
   **
   ************************************************************************/

  getValue: function(opts) {
    if (Util._.isUndefined(opts) || Util._.isUndefined(opts.attribute)) {
      return this.value.html();
    } else {
      return this.value.attr(opts.attribute);
    }
  },

  setValue: function(value, opts) {
    var v = value;
    if (opts && opts.prefix) {
      v = opts.prefix + v;
    }
    if (opts && opts.suffix) {
      v = v + opts.suffix;
    }
    if (Util._.isUndefined(opts) || Util._.isUndefined(opts.attribute)) {
      this.value.html("" + v);
    } else {
      if (opts.attribute != null) {
        this.value.attr(opts.attribute, v);
      }
    }
  },

  _subclass_unrealize: function() {
    this.value.data('ctsnode', null);
  },

  /************************************************************************
   **
   ** Events
   **
   ************************************************************************/

  /* Toggles whether this node will throw events when its data change. If so,
   * the event will be thrown by calling Node (superclass)'s
   * _throwEvent(name, data)
   */
  _subclass_throwChangeEvents: function(toggle, subtree) {
    if (typeof this._valueChangedListenerProxy == 'undefined') {
      this._valueChangedListenerProxy = Util.$.proxy(this._subclass_valueChangedListener, this);
    }

    var existing = (this._subclass_proxy_handleDomChange != null);
    // GET
    if (typeof toggle == 'undefined') {
      return existing;
    }
    // SET NO-OP
    if (toggle == existing) {
      return toggle;
    }

    var self = this;
    if (toggle) {
      // SET ON
      // This funny way of implementing is to save the "this" pointer.
      this._subclass_proxy_handleDomChange = function(e) {
        self._subclass_handleDomChangeEvent(e);
      }
      this._changeObserver = new MutationObserver(this._subclass_proxy_handleDomChange);
      var opts = {

      };
      this._changeObserver.observe(this.value[0], {
        attribute: true,
        characterData: true,
        childList: true,
        subtree: true
      });
    } else {
      // SET OFF
      this._changeObserver.disconnect();
      this._changeObserver = null;
      this._subclass_proxy_handleDomChange = null;
    }
  },

  click: function(fn) {
    this.value.on('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      fn();
    });
  },

  _subclass_handleDomChangeEvent: function(mrs) {
    Util.Log.Info("Change Occured", this, mrs);
    for (var j = 0; j < mrs.length; j++) {
      var mr = mrs[j];

      // Destroy the CTS accounting for any nodes that were removed.
      for (var i = 0; i < mr.removedNodes.length; i++) {
        var $removedNode = Util.$(mr.removedNodes[i]);
        var $$rn = $removedNode.data('ctsNode');
        if ($$rn) {
            $$rn.destroy(false);
        }
      }

      for (var i = 0; i < mr.addedNodes.length; i++) {
        var $addedNode = Util.$(mr.addedNodes[i]);
        this._maybeThrowDataEvent({
          eventName: "ValueChanged",
          node: $addedNode,
          ctsNode: $addedNode.data('ctsnode')
        });
      }

      if (mr.type == "characterData") {
        var textNode = mr.target;
        var $changedNode = Util.$(textNode.parentElement);
        this._maybeThrowDataEvent({
          eventName: "ValueChanged",
          node: $changedNode,
          ctsNode: $changedNode.data('ctsnode')
        });
      }
    }

  }

});

module.exports = {
  HtmlNode: HtmlNode,
  CreateHtmlNode: CreateHtmlNode
};