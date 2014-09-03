var HtmlTree = require('./dom-tree');
var HtmlNode = require('./dom-node');
var HtmlInputNode = require('./dom-node-input');

var Util = require('cts/util');

module.exports = {
  TreeWithJquery: function(node, forrest, spec) {
    var promise = Util.Promise.defer();
    var tree = new HtmlTree(forrest, spec);
    HtmlNode.CreateHtmlNode(node, tree).then(
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
  }
}



