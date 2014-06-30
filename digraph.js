var Vertex = require("./vertex");

var VALID_STATES = ["NOT_READY", "READY", "IN_PROGRESS", "SUCCESS", "FAIL"];


/**
 * Creates a digraph
 *
 * @constructor
 * @param {string} pkGloballyUniqueId - GUID for digraph; passed-in from PigeonKeeper
 */
function Digraph(pkGloballyUniqueId)
{
    var self = this;

    var pkGuid              = pkGloballyUniqueId;
    var vertexArray         = [];       // Note: these three arrays are kept in parallel for ease of access as well as to increase search speed
    var vertexIdArray       = [];
    var vertexStateArray    = [];

    var startVertexIdArray  = [];       // Note: these two arrays are how directed edges are stored
    var endVertexIdArray    = [];


    /**
     * Is there a vertex in the digraph with that ID?
     *
     * @param {string} vertexId - ID of a vertex
     * @returns {boolean}
     */
    this.hasVertexId = function (vertexId)
    {
        return vertexIdArray.indexOf(vertexId) > -1;
    };

    /**
     * Creates a new vertex in the digraph
     *
     * @param {string} id - ID of the new vertex
     * @param {Object} data - Optional data object associated with the vertex
     * @returns {Vertex}
     */
    this.addVertex = function (id, data)
    {
        if(vertexIdArray.indexOf(id) > -1)
        {
            throw new Error("Duplicate Vertex ID", "Vertex with the ID " + id + " already exists!");
        }
        else
        {
            var newVertex = new Vertex(pkGuid, id, "NOT_READY", data);
            newVertex.parent = self;
            vertexIdArray.push(id);
            vertexStateArray.push("NOT_READY");
            vertexArray.push(newVertex);
            return newVertex;
        }
    };

    /**
     * Adds a directed edge to the digraph from startVertexId to endVertexId
     *
     * @param {string} startVertexId - Where the edge starts
     * @param {string} endVertexId - Where the edge ends
     */
    this.addEdge = function (startVertexId, endVertexId)
    {
        if(vertexIdArray.indexOf(startVertexId) == -1)
        {
            throw new Error("Start Vertex Not Found", "Start vertex (with the ID " + startVertexId + ") not found!");
        }
        else if(vertexIdArray.indexOf(endVertexId) == -1)
        {
            throw new Error("End Vertex Not Found", "End vertex (with the ID " + endVertexId + ") not found!");
        }
        else if(startVertexId == endVertexId)
        {
            throw new Error("Loops Not Allowed", "The start vertex and the end vertex are the same (vertex ID " + startVertexId + ")!");
        }
        else
        {
            var numEdges = startVertexIdArray.length;
            var duplicateEdgeFound = false;

            for(var i = 0; i < numEdges; i++)
            {
                if(startVertexIdArray[i] == startVertexId && endVertexIdArray[i] == endVertexId)
                {
                    duplicateEdgeFound = true;
                    break;
                }
            }

            if(duplicateEdgeFound)
            {
                throw new Error("Edge Already Exists", "Edge (" + startVertexId + ", " + endVertexId + ") already exists!");
            }
            else
            {
                startVertexIdArray.push(startVertexId);
                endVertexIdArray.push(endVertexId);
            }
        }
    };

    /**
     * Removes the vertex with the given vertexId
     *
     * @param {string} vertexId - ID of the vertex to remove
     */
    this.removeVertex = function (vertexId)
    {
        if(vertexIdArray.index(vertexId) == -1)
        {
            throw new Error("Vertex Not Found", "Vertex (with the ID " + vertexId + ") not found!");
        }
        else
        {
            // First, remove it from the vertex arrays
            var vertexIndex = vertexIdArray.indexOf(vertexId);
            vertexIdArray.splice(vertexIndex, 1);
            vertexStateArray.splice(vertexIndex, 1);
            vertexArray.splice(vertexIndex, 1);

            // Now remove the edges
            var numEdges = startVertexIdArray.length;
            for(var i = numEdges-1; i >= 0; i--)
            {
                if(startVertexIdArray[i] == vertexId || endVertexIdArray[i] == vertexId)
                {
                    startVertexIdArray.splice(i, 1);
                    endVertexIdArray.splice(i, 1);
                }
            }
        }
    };

    /**
     * Removes the edge going from startVertexId to endVertexId
     *
     * @param {string} startVertexId - Where the edge starts
     * @param {string} endVertexId - Where the edge ends
     */
    this.removeEdge = function (startVertexId, endVertexId)
    {
        var numEdges = startVertexIdArray.length;
        var edgeIndex = -1;

        // NOTE: this next part assumes that no duplicate edges exist
        for(var i = 0; i < numEdges; i++)
        {
            if(startVertexIdArray[i] == startVertexId && endVertexIdArray[i] == endVertexId)
            {
                edgeIndex = i;
                break;
            }
        }

        if(edgeIndex == -1)
        {
            throw new Error("Edge Doesn't Exist", "Edge (" + startVertexId + ", " + endVertexId + ") does not exist!");
        }
        else
        {
            startVertexIdArray.splice(edgeIndex, 1);
            endVertexIdArray.splice(edgeIndex, 1);
        }
    };

    /**
     * Gets all child vertices (objects) of the vertex with the given parentVertexId
     *
     * @param {string} parentVertexId - ID of the parent vertex
     * @returns {Array}
     */
    this.getChildVertices = function (parentVertexId)
    {
        var numEdges = startVertexIdArray.length;
        var childVertices = [];

        for(var i = 0; i < numEdges; i++)
        {
            if(startVertexIdArray[i] == parentVertexId)
            {
                childVertices.push(vertexArray[vertexIdArray.indexOf(endVertexIdArray[i])]);
            }
        }

        return childVertices;
    };

    /**
     * Gets the IDs of all child vertices of parentVertexId
     *
     * @param {string} parentVertexId - ID of the parent vertex
     * @returns {Array}
     */
    this.getChildVertexIds = function (parentVertexId)
    {
        var numEdges = startVertexIdArray.length;
        var childVertexIds = [];

        for(var i = 0; i < numEdges; i++)
        {
            if(startVertexIdArray[i] == parentVertexId)
            {
                childVertexIds.push(vertexArray[vertexIdArray.indexOf(endVertexIdArray[i])].id);
            }
        }

        return childVertexIds;
    };

    /**
     * Gets all parent vertices (objects) of the vertex with the given childVertexId
     *
     * @param {string} childVertexId - ID of the child vertex
     * @returns {Array}
     */
    this.getParentVertices = function (childVertexId)
    {
        var numEdges = startVertexIdArray.length;
        var parentVertices = [];

        for(var i = 0; i < numEdges; i++)
        {
            if(endVertexIdArray[i] == childVertexId)
            {
                parentVertices.push(vertexArray[vertexIdArray.indexOf(startVertexIdArray[i])]);
            }
        }

        return parentVertices;
    };

    /**
     * Gets the IDs of all parents of the specified vertex
     *
     * @param {string} childVertexId - ID of the child vertex
     * @returns {Array}
     */
    this.getParentVertexIds = function (childVertexId)
    {
        var numEdges = startVertexIdArray.length;
        var parentVertexIds = [];

        for(var i = 0; i < numEdges; i++)
        {
            if(endVertexIdArray[i] == childVertexId)
            {
                parentVertexIds.push(vertexArray[vertexIdArray.indexOf(startVertexIdArray[i])].id);
            }
        }

        return parentVertexIds;
    };

    /**
     * How many edges are coming into this vertex?
     *
     * @param {string} vertexId - The vertex ID
     * @returns {number}
     */
    this.indegree = function (vertexId)
    {
        var numEdges = startVertexIdArray.length;
        var count = 0;

        for(var i = 0; i < numEdges; i++)
        {
            if(endVertexIdArray[i] == vertexId)
            {
                count++;
            }
        }
        return count;
    };

    /**
     * How many edges are leaving from this vertex?
     *
     * @param {string} vertexId - The vertex ID
     * @returns {number}
     */
    this.outdegree = function (vertexId)
    {
        var numEdges = startVertexIdArray.length;
        var count = 0;

        for(var i = 0; i < numEdges; i++)
        {
            if(startVertexIdArray[i] == vertexId)
            {
                count++;
            }
        }
        return count;
    };

    /**
     * Returns list of vertices (objects) with indegree == 0
     *
     * @returns {Array}
     */
    this.getVerticesWithIndegree0 = function ()
    {
        var numVertices = vertexArray.length;
        var verticesWithIndegree0 = [];

        for(var i = 0; i < numVertices; i++)
        {
            if(endVertexIdArray.indexOf(vertexArray[i].id) == -1)
            {
                verticesWithIndegree0.push(vertexArray[i]);
            }
        }

        return verticesWithIndegree0;
    };

    /**
     * Gets vertex (object) with specified ID
     *
     * @param {string} vertexId - The vertex ID
     * @returns {*}
     */
    this.getVertex = function (vertexId)
    {
        var vertexIndex = vertexIdArray.indexOf(vertexId);

        if(vertexIndex == -1)
        {
            throw new Error("Vertex Not Found", "Vertex (with the ID " + vertexId + ") not found!");
        }
        else
        {
            return vertexArray[vertexIndex];
        }
    };

    /**
     * Returns list of the IDs of all the vertices
     *
     * @returns {Array}
     */
    this.getVertexIds = function ()
    {
        var vertexIds = [];
        var numVertices = vertexArray.length;

        for(var i = 0; i < numVertices; i++)
        {
            vertexIds.push(vertexIdArray[i]);
        }

        return vertexIds;
    };

    /**
     * How many vertices are in the digraph?
     *
     * @returns {Number}
     */
    this.vertexCount = function ()
    {
        return vertexArray.length;
    };

    /**
     * How many edges are in the digraph?
     *
     * @returns {Number}
     */
    this.edgeCount = function ()
    {
        return startVertexIdArray.length;
    };

    /**
     * Performs a topological sort on the vertices of the digraph, implemented using Kahn's algorithm <br />
     * See Wikipedia for details: {@link http://en.wikipedia.org/wiki/Topological_sort}
     *
     * @returns {Array}
     */
    this.topologicalSort = function ()
    {
        // Based upon Kahn's algorithm from
        // http://en.wikipedia.org/wiki/Topological_sort

        // Make a copy of the edge set, since Kahn's algorithm will destroy that info!
        // We'll restore the info at the end
        var edgeInfo = this.getEdgeInfo();

        var L = [];
        var S = this.getVerticesWithIndegree0();

        while(S.length > 0)
        {
            var n = S.pop();
            L.push(n);
            var childNodes = this.getChildVertices(n.id);
            var numChildren = childNodes.length;
            for(var i = 0; i < numChildren; i++)
            {
                var m = childNodes[i];
                this.removeEdge(n.id, m.id);

                if(this.indegree(m.id) == 0)
                {
                    S.push(m);
                }
            }
        }
        if(this.edgeCount() > 0)
        {
            this.setEdgeInfo(edgeInfo);
            return [];
        }
        else
        {
            this.setEdgeInfo(edgeInfo);
            return L;
        }
    };

    /**
     * Returns a clone of the start and end vertex arrays - used as part of the topological sort, since it is destructive
     *
     * @returns {{startVertexIdArray: *, endVertexIdArray: *}}
     */
    this.getEdgeInfo = function ()
    {
        var edgeInfo = {
            "startVertexIdArray": clone(startVertexIdArray),
            "endVertexIdArray": clone(endVertexIdArray)
        };

        return edgeInfo;
    };

    /**
     * Sets the start and end vertex arrays - used as part of the topological sort, since it is destructive
     *
     * @param edgeInfo
     */
    this.setEdgeInfo = function (edgeInfo)
    {
        startVertexIdArray = clone(edgeInfo.startVertexIdArray);
        endVertexIdArray = clone(edgeInfo.endVertexIdArray);
    };

    /**
     * Creates a deep copy of a JS object
     * Code from {@link http://stackoverflow.com/questions/728360/most-elegant-way-to-clone-a-javascript-object}
     *
     * @private
     * @param {Object} obj - Opject to clone
     * @returns {*}
     */
    function clone(obj)
    {
        // Based upon http://stackoverflow.com/questions/728360/most-elegant-way-to-clone-a-javascript-object
        if(obj == null || typeof obj != "object")
        {
            return obj;
        }
        else
        {
            var copy = obj.constructor();
            for(var attr in obj)
            {
                if(obj.hasOwnProperty(attr))
                {
                    copy[attr] = obj[attr];
                }
            }
            return copy;
        }
    }

    /**
     * Returns the digraph's vertices and edges, formatted all pretty like
     *
     * @returns {string}
     */
    this.asString = function ()
    {
        var numEdges = startVertexIdArray.length;
        var edgeArray = [];

        for(var i = 0; i < numEdges; i++)
        {
            edgeArray.push({"start":startVertexIdArray[i], "end":endVertexIdArray[i]});
        }

        var str = "";

        str += "{" + "\n";
        str += "     \"vertices\": " + JSON.stringify(vertexArray) + "," + "\n";
        str += "     \"edges\": " + JSON.stringify(edgeArray) + "\n";
        str += "}";

        return str;
    };
}

if(typeof module !== "undefined")
{
    module.exports = Digraph;
}
