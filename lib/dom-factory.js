var HtmlTree = require('./dom-tree');
var HtmlNode = require('./dom-node');
var HtmlInputNode = require('./dom-node-input');

var Util = require('cts/util');

module.exports = {
  TreeWithJquery: function(node, forrest, spec) {
    var promise = Util.Promise.defer();
    var tree = new HtmlTree(forrest, spec);
    module.exports.HtmlNode(node, tree).then(
      function(ctsNode) {
        ctsNode.realizeChildren().then(
          function() {
            tree.setRoot(ctsNode);
            if (spec.receiveEvents) {
              tree.toggleReceiveRelationEvents(true);
            }
            promise.resolve(tree);
          },
          function(reason) {
            promise.reject(reason);
          }
        );
      },
      function(reason) {
        promise.reject(reason);
      }
    );
    return promise;
  },

  HtmlNode: function(node, tree, opts) {
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
  }
}



