var events = require("events");

/**
 * @enum {string}
 */
var VALID_STATES = ["NOT_READY", "READY", "IN_PROGRESS", "SUCCESS", "FAIL"];


/**
 * Creates a vertex for use in a digraph
 *
 * @constructor
 * @param {string} pkGloballyUniqueId - ID of the associated PigeonKeeper, usually passed-in from digraph
 * @param {string} id - The ID of this vertex
 * @param {VALID_STATES} state - The initial state of this vertex
 * @param {Object} data - Optional data object associated with this vertex
 */
function Vertex(pkGloballyUniqueId, id, state, data)
{
    var self = this;
    var pkGuid = pkGloballyUniqueId;
    var serviceStartMethod;

    if(VALID_STATES.indexOf(state) > -1)
    {
        this.id = id;
        this.state = state;
        this.data = data;
    }
    else
    {
        throw new Error("Invalid State", "Invalid initial state: " + state);
    }

    /**
     * Set state of the vertex
     *
     * @param {VALID_STATES} newState - The new state
     */
    this.setState = function (newState)
    {
        if(VALID_STATES.indexOf(newState) > -1)
        {
            this.state = newState;

            if(newState == "IN_PROGRESS")
            {
                if(self.parent.parent.isRunning())
                {
                    self.emit(pkGuid + ":" + "start");
                }
                else
                {
                    // Ignore state changes when PK has stopped running
                }
            }
        }
        else
        {
            throw new Error("Invalid State", "Invalid state: " + newState);
        }
    };

    /**
     * Method that PK calls when associated service is to be started
     *
     * @param {Function} serviceStart - Method that PK will call
     */
    this.setServiceStartMethod = function (serviceStart)
    {
        serviceStartMethod = serviceStart;
    };

    /**
     * Called by PK when associated process is successful
     *
     * @param {*} data - Data returned by process
     */
    this.processSuccessful = function (data)
    {
        this.data = data;
        self.parent.parent.setState(id, "SUCCESS");
    };

    /**
     * Called by PK when process fails
     *
     * @param {*} err - Error object
     */
    this.processFailed = function (err)
    {
        self.parent.parent.setState(id, "FAIL");
    };
}

// Next line makes this object inherit from events.EventEmitter
Vertex.prototype.__proto__ = events.EventEmitter.prototype;

if(typeof module !== "undefined")
{
    module.exports = Vertex;
}
