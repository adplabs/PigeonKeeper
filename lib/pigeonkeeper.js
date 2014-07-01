/**
 * @fileOverview
 * @version 10
 * @author Mike Klepper
 */

/*
NOTE: to generate JSDocs...
- Open command line prompt
- Change directory into the lib folder
- Use the following command: jsdoc pigeonkeeper.js digraph.js vertex.js -d ../jsdocs
*/

// This file is hosted on GitHub!

var VERSION = "10";
var VALID_STATES = ["NOT_READY", "READY", "IN_PROGRESS", "SUCCESS", "FAIL"];

var Digraph = require("./digraph");

/**
 * Constructor
 *
 * @constructor
 * @param pkName {string} - Instance name, which will be modified into a GUID
 * @param finalCallback {Function} - Function to be called when PK quits
 * @param quitOnFailure {boolean} - When true, PK quits when single process fails; when false, PK tries to stay calm and carry on
 * @param maxNumRunningProcesses {number} - Maximum number of running processes
 * @param {Object} logger - A logging utility that has an addLog method
 * @param userObject {Object} - Object used by the logger
 */
function PigeonKeeper(pkName, finalCallback, quitOnFailure, maxNumRunningProcesses, logger, userObject)
{
    var self = this;
    var pkGuid = pkName + "-" + guid();
    var loggingMechanism = logger;
    var logUserObject = userObject;

    var graph = new Digraph(pkGuid);
    graph.parent = self;

    var finalCallbackExecuted = false;

    var finalCallback = finalCallback;

    var quitOnFailure = quitOnFailure;

    var isCurrentlyRunning = false;
    var maxNumberOfRunningProcesses = maxNumRunningProcesses;
    var numberOfRunningProcesses = 0;

    var topologicalSortOrder;       // Computed when we start PK

    var results = {};

    /**
     * Returns the version of this PK
     *
     * @returns {string}
     */
    this.getVersion = function ()
    {
        return VERSION;
    };

    /**
     * Is the PK currently running?
     *
     * @returns {boolean}
     */
    this.isRunning = function ()
    {
        return isCurrentlyRunning;
    };

    /**
     * Adds a vertex to the underlying graph and associates the specified service with it
     *
     * @param {string} vertexId - ID of a vertex in the digraph
     * @param {Object} service - An event emitter (either emits "success" or "error")
     * @param {Function} serviceStart - Method of the service which PK will call
     */
    this.addVertex = function (vertexId, service, serviceStart)
    {
        // Create a vertex...
        var newVertex = graph.addVertex(vertexId, {});

        //...and associate the service with it
        newVertex.once(pkGuid + ":" + "start", function () {writeToLog("INFO", "Starting " + vertexId); return serviceStart(results)});
        service.once("success", newVertex.processSuccessful);
        service.once("error", newVertex.processFailed);
    };

    /**
     * Adds a directed edge from one vertex to another vertex in the underlying graph
     *
     * @param startVertexId {string} - Where the edge starts
     * @param endVertexId {string} - Where the edge ends
     */
    this.addEdge = function (startVertexId, endVertexId)
    {
        graph.addEdge(startVertexId, endVertexId);
    };

    /**
     * Starts the PK a-runnin'!
     *
     * @param {Object} sharedData - Common object that processes can modify
     */
    this.start = function (sharedData)
    {
        finalCallbackExecuted = false;
        results = sharedData;
        topologicalSortOrder = vertexIdsFromArray(graph.topologicalSort());
        //writeToLog("INFO", "topologicalSortOrder = " + topologicalSortOrder);
        numberOfRunningProcesses = 0;
        isCurrentlyRunning = true;
        initializeStates();
        updateStates();
        startReadyProcesses();
    };

    /**
     * Sets the state of the vertex with vertexId; tests whether it is OK to run finalCallback - ordinarily does NOT need to be called directly
     *
     * @param {string} vertexId - ID of a vertex in the digraph
     * @param {VALID_STATES} newState - The new state
     */
    this.setState = function (vertexId, newState)
    {
        var pkError = null;
        var currentPkState;

        if(graph.hasVertexId(vertexId))
        {
            if(VALID_STATES.indexOf(newState) > -1)
            {
                graph.getVertex(vertexId).setState(newState);

                if(newState == "SUCCESS")
                {
                    numberOfRunningProcesses--;
                    //writeToLog("INFO", "Just decremented numberOfRunningProcesses for SUCCESS, now is " + numberOfRunningProcesses);
                    updateStates();

                    var allStatesSuccessful = true;
                    var someStateFailed = false;
                    var allStatesFinal = true;

                    var numVertices = graph.vertexCount();
                    var vertexIds = graph.getVertexIds();

                    for(var i = 0; i < numVertices; i++)
                    {
                        var currentVertex = graph.getVertex(vertexIds[i]);
                        allStatesSuccessful = allStatesSuccessful && currentVertex.state == "SUCCESS";
                        someStateFailed = someStateFailed || currentVertex.state == "FAIL";
                        allStatesFinal = allStatesFinal && (currentVertex.state == "SUCCESS" || currentVertex.state == "FAIL");
                    }

                    //writeToLog("INFO", "***** allStatesSuccessful = " + allStatesSuccessful + "; someStateFailed = " + someStateFailed + "; allStatesFinal = " + allStatesFinal);

                    // TODO: clean-up this logic
                    if(allStatesFinal)
                    {
                        isCurrentlyRunning = false;
                        if(allStatesSuccessful)
                        {
                            writeToLog("INFO", "All tasks completed successfully, ooh RAH!");

                            if(!finalCallbackExecuted)
                            {
                                writeToLog("INFO", "Final callback executing");
                                finalCallbackExecuted = true;
                                finalCallback(null, results);
                                writeToLog("INFO", "Final callback executed");
                            }

                        }
                        else
                        {
                            writeToLog("ERROR", "One task failed, :-(");

                            if(!finalCallbackExecuted)
                            {
                                writeToLog("INFO", "Final callback executing");
                                finalCallbackExecuted = true;
                                currentPkState = self.overallState();
                                pkError = {name:"Failed States", message:currentPkState.FAIL};
                                finalCallback(pkError, results);
                                writeToLog("INFO", "Final callback executed");
                            }
                        }
                    }
                    else if(allStatesSuccessful)
                    {
                        writeToLog("INFO", "All tasks completed successfully, ooh RAH!");

                        if(!finalCallbackExecuted)
                        {
                            writeToLog("INFO", "Final callback executing");
                            finalCallbackExecuted = true;
                            finalCallback(null, results);
                            writeToLog("INFO", "Final callback executed");
                        }
                    }
                    else if(someStateFailed)
                    {
                        writeToLog("ERROR", "Some task failed!");

                        if(quitOnFailure)
                        {
                            isCurrentlyRunning = false;

                            if(!finalCallbackExecuted)
                            {
                                writeToLog("INFO", "Final callback executing");
                                finalCallbackExecuted = true;
                                currentPkState = self.overallState();
                                pkError = {name:"Failed States", message:currentPkState.FAIL};
                                finalCallback(pkError, results);
                                writeToLog("INFO", "Final callback executed");
                            }
                        }
                        else
                        {
                            updateStates();
                        }
                    }
                    else
                    {
                        startReadyProcesses();
                    }
                }
                else if(newState == "FAIL")
                {
                    writeToLog("ERROR", "Task failed - darn!");
                    numberOfRunningProcesses--;
                    //writeToLog("INFO", "Just decremented numberOfRunningProcesses for FAIL, now is " + numberOfRunningProcesses);
                    updateStates();

                    var allStatesSuccessful = true;
                    var someStateFailed = false;
                    var allStatesFinal = true;

                    var numVertices = graph.vertexCount();
                    var vertexIds = graph.getVertexIds();

                    for(var i = 0; i < numVertices; i++)
                    {
                        var currentVertex = graph.getVertex(vertexIds[i]);
                        allStatesSuccessful = allStatesSuccessful && currentVertex.state == "SUCCESS";
                        someStateFailed = someStateFailed || currentVertex.state == "FAIL";
                        allStatesFinal = allStatesFinal && (currentVertex.state == "SUCCESS" || currentVertex.state == "FAIL");
                    }

                    if(quitOnFailure)
                    {
                        isCurrentlyRunning = false;

                        if(!finalCallbackExecuted)
                        {
                            writeToLog("INFO", "Final callback executing");
                            finalCallbackExecuted = true;
                            pkError = {name:"State Failed", message:vertexId};
                            finalCallback(pkError, results);
                            writeToLog("INFO", "Final callback executed");
                        }
                    }
                    else
                    {
                        updateStates();

                        if(allStatesFinal && someStateFailed)
                        {
                            if(!finalCallbackExecuted)
                            {
                                writeToLog("INFO", "Final callback executing");
                                finalCallbackExecuted = true;
                                currentPkState = self.overallState();
                                pkError = {name:"Failed States", message:currentPkState.FAIL};
                                finalCallback(pkError, results);
                                writeToLog("INFO", "Final callback executed");
                            }
                        }
                    }
                }
            }
            else
            {
                // Attempt was made to set the vertex's state to something other than the allowable states!
                throw new Error("Invalid State", newState);
            }
        }
        else
        {
            // Attempt was made to set the state of a non-existent vertex!
            throw new Error("Vertex Not Found", vertexId);
        }
        //console.log("In setState, allStatesFinal = " + allStatesFinal);
        //console.log("In setState, overall state = " + this.overallStateAsString());
    };

    /**
     * Debugging function - returns description of the PK's current condition, including the states of each vertex
     *
     * @returns {{}}
     */
    this.overallState = function ()
    {
        var pkOverallState = {};

        var notReadyVertices = [];
        var readyVertices = [];
        var inProgressVertices = [];
        var successVertices = [];
        var failVertices = [];

        var vertexStates = [notReadyVertices, readyVertices, inProgressVertices, successVertices, failVertices];

        var numVertices = graph.vertexCount();
        var vertexIds = graph.getVertexIds();

        pkOverallState["globallyUniqueId"] = pkGuid;

        pkOverallState["topologicalSortOrder"] = topologicalSortOrder;

        for(var i = 0; i < numVertices; i++)
        {
            var currentVertexState = graph.getVertex(vertexIds[i]).state;
            var stateIndex = VALID_STATES.indexOf(currentVertexState);

            vertexStates[stateIndex].push(vertexIds[i]);
        }

        for (var i = 0; i < VALID_STATES.length; i++)
        {
            //writeToLog("INFO", "   " + VALID_STATES[i] + ": " + vertexStates[i]);
            pkOverallState[VALID_STATES[i]] = vertexStates[i];
        }

        pkOverallState["quitOnFailure"] = quitOnFailure;
        pkOverallState["isRunning"] = isCurrentlyRunning;
        pkOverallState["maxNumberOfRunningProcesses"] = maxNumberOfRunningProcesses;
        pkOverallState["numberOfRunningProcesses"] = numberOfRunningProcesses;
        pkOverallState["results"] = results;

        return pkOverallState;
    };

    /**
     * Debugging function - for pretty-printing the overallState()
     *
     * @returns {string}
     */
    this.overallStateAsString = function ()
    {
        var pkOverallState = this.overallState();
        var pkOverallStateAsString = "";

        pkOverallStateAsString += "Overall PigeonKeeper State:" + "\n";

        pkOverallStateAsString += "   " + "globallyUniqueId = " + pkOverallState.globallyUniqueId + "\n";
        pkOverallStateAsString += "   " + "Topological sort = " + pkOverallState.topologicalSortOrder + "\n";
        pkOverallStateAsString += "   " + "Quits immediately on failure = " + pkOverallState.quitOnFailure + "\n";

        if(maxNumberOfRunningProcesses <= 0)
        {
            pkOverallStateAsString += "   " + "Max number of running processes is unbounded" + "\n";
        }
        else
        {
            pkOverallStateAsString += "   " + "Max number of running processes = " + pkOverallState.maxNumberOfRunningProcesses + "\n";
        }
        pkOverallStateAsString += "   " + "Current number of running processes = " + pkOverallState.numberOfRunningProcesses + "\n";

        pkOverallStateAsString += "   " + "Vertices by State:" + "\n";
        for (var i = 0; i < VALID_STATES.length; i++)
        {
            pkOverallStateAsString += "   " + "   " + VALID_STATES[i] + ": " + pkOverallState[VALID_STATES[i]] + "\n";
        }
        pkOverallStateAsString += "   " + "PK is running = " + pkOverallState.isRunning + "\n";

        pkOverallStateAsString += "   " + "results = " + JSON.stringify(pkOverallState.results) + "\n";

        return pkOverallStateAsString;
    };

    /**
     * Returns the sharedData object specified in the start method
     *
     * @returns {{}}
     */
    this.getResults = function ()
    {
        return results;
    };

    /**
     * Sets states of all vertices to be NOT_READY
     *
     * @private
     */
    function initializeStates()
    {
        // Set all states to NOT_READY
        var numVertices = graph.vertexCount();
        var vertexIds = graph.getVertexIds();

        for(var i = 0; i < numVertices; i++)
        {
            graph.getVertex(vertexIds[i]).setState("NOT_READY");
        }
    }

    /**
     * Updates all the states in the PK; follows rules specified in the MS Word/PDF docs
     *
     * @private
     */
    function updateStates()
    {
        var numVertices = graph.vertexCount();
        var newStates = [];

        // Calculate new states without changing current states
        for(var i = 0; i < numVertices; i++)
        {
            var currentVertex = graph.getVertex(topologicalSortOrder[i]);

            if(currentVertex.state == "NOT_READY")
            {
                if(graph.indegree(currentVertex.id) == 0)
                {
                    newStates.push("READY");
                }
                else
                {
                    var parents = graph.getParentVertexIds(currentVertex.id);
                    var numParents = parents.length;
                    var allParentsAreSuccess = true;
                    var someParentFailed = false;

                    for(var j = 0; j < numParents; j++)
                    {
                        var currentParent = graph.getVertex(parents[j]);
                        allParentsAreSuccess = allParentsAreSuccess && currentParent.state == "SUCCESS";
                        someParentFailed = someParentFailed || currentParent.state == "FAIL";
                    }

                    if(allParentsAreSuccess)
                    {
                        newStates.push("READY");
                    }
                    else if(someParentFailed)
                    {
                        newStates.push("FAIL");
                    }
                    else
                    {
                        newStates.push("NOT_READY");
                    }
                }
            }
            else
            {
                newStates.push(currentVertex.state);
            }
        }

        // Transfer new states to the vertices
        for(var i = 0; i < numVertices; i++)
        {
            var currentVertex = graph.getVertex(topologicalSortOrder[i]);
            currentVertex.setState(newStates[i]);
        }
    }

    /**
     * Starts all processes where associated vertices are READY
     *
     * @private
     */
    function startReadyProcesses()
    {
        // Start as many processes as we can!
        //writeToLog("INFO", "***** maxNumberOfRunningProcesses = " + maxNumberOfRunningProcesses + "; numberOfRunningProcesses = " + numberOfRunningProcesses);
        var numVertices = graph.vertexCount();
        var vertexIds = graph.getVertexIds();

        for(var i = 0; i < numVertices; i++)
        {
            if(graph.getVertex(vertexIds[i]).state == "READY")
            {
                if(maxNumberOfRunningProcesses > 0 && numberOfRunningProcesses < maxNumberOfRunningProcesses)
                {
                    numberOfRunningProcesses++;
                    graph.getVertex(vertexIds[i]).setState("IN_PROGRESS");
                }
                else if(maxNumberOfRunningProcesses <= 0)
                {
                    numberOfRunningProcesses++;
                    graph.getVertex(vertexIds[i]).setState("IN_PROGRESS");
                }
            }
        }
    }

    /**
     * Extracts the vertexIDs from a given array of vertices
     *
     * @private
     * @param {Array} arr - Array of vertices
     * @returns {Array}
     */
    function vertexIdsFromArray(arr)
    {
        var numVertices = arr.length;
        var vertexIds = [];

        for(var i = 0; i < numVertices; i++)
        {
            vertexIds.push(arr[i].id);
        }

        return vertexIds;
    }

    /**
     * Wrapper around logging mechanism's addLog method
     *
     * @private
     * @param level
     * @param {string} msg
     */
    function writeToLog(level, msg)
    {
        var displayPrefix = "PK-" + pkGuid + ": ";
        if(loggingMechanism && logUserObject)
        {
            loggingMechanism.addLog(level, displayPrefix + msg, logUserObject);
        }
        else
        {
            console.log(displayPrefix + msg);
        }
    }

    // Next two functions are from http://note19.com/2007/05/27/javascript-guid-generator/

    /**
     * Used to generate a GUID
     * @link http://note19.com/2007/05/27/javascript-guid-generator/
     *
     * @private
     * @returns {string}
     */
    function s4()
    {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }

    /**
     * Used to generate a GUID
     * @link http://note19.com/2007/05/27/javascript-guid-generator/
     *
     * @private
     * @returns {string}
     */
    function guid()
    {
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    }
}

if(typeof module !== "undefined")
{
    module.exports = PigeonKeeper;
}
