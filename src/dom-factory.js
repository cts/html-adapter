CTS.registerNamespace('CTS.Adapters.Html.Factory');

CTS.Adapters.Html.Factory.TreeWithJquery = function(node, forrest, spec) {
  var promise = CTS.Promise.defer();
  var tree = new CTS.Adapters.Html.HtmlTree(forrest, spec);
  CTS.Adapters.Html.Factory.HtmlNode(node, tree).then(
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
};

CTS.Adapters.Html.Factory.HtmlNode = function(node, tree, opts) {
  var deferred = CTS.Promise.defer();
  var klass = CTS.Adapters.Html.HtmlNode;

  if (! CTS.Fn.isUndefined(node.jquery)) {
    if (node.is('input') || node.is('select')) {
      klass = CTS.Adapters.Html.HtmlInputNode;
    }
  } else if (node instanceof Element) {
    if ((node.nodeName == 'INPUT') || (node.nodeName == 'SELECT')) {
      klass = CTS.Adapters.Html.HtmlInputNode;
    }
  }

  var node = new klass(node, tree, opts);
  node.parseInlineRelationSpecs().then(
    function() {
      if (node == null) {
        CTS.Log.Error("Created NULL child");
      }
      deferred.resolve(node);
    },
    function(reason) {
      deferred.reject(reason);
    }
  );
  return deferred.promise;
};