var events = require("events");
var SERVICE_ALWAYS_FAILS = false;
var BAD_SERVICE_ID = "-1"; // "3"

/**
 * Event emitter; this code is to be used as a sample of how to implement an event emitter for use with PigeonKeeper
 *
 * @constructor
 * @param {string} serviceId - ID of the service
 * @fires "success"
 * @fires "error"
 */
function GenericService(serviceId)
{
    var self = this;
    var id = serviceId;
    var data = {};

    /**
     * Method called by PK
     *
     * @param {Object} sharedData - Data object that gets passed-around by PK
     */
    this.doStuff = function (sharedData)
    {
        console.log("In service #" + id + ", a = " + sharedData.a + " and b = " + sharedData.b);

        if(SERVICE_ALWAYS_FAILS)
        {
            var err = new Error("Service failed", "Service failed - it always does!");
            onServiceError(err, sharedData);
        }
        else
        {
            if(id != BAD_SERVICE_ID)
            {
                data = {"id": id};
                onServiceSuccess(data, sharedData);
            }
            else
            {
                var err = new Error("Service " + BAD_SERVICE_ID + " failed", "Service " + BAD_SERVICE_ID + " failed - it always does!");
                onServiceError(err, sharedData);
            }
        }
    };

    /**
     * @private
     * @param {Object} data
     * @param {Object} sharedData
     */
    function onServiceSuccess(data, sharedData)
    {
        console.log("In GenericService" + id + ".onServiceSuccess: " + JSON.stringify(data));

        sharedData[id] = {value: "This is the result from successful service #" + id};
        self.emit("success", data);
    }

    /**
     * @private
     * @param err
     * @param {Object} sharedData
     */
    function onServiceError(err, sharedData)
    {
        console.log("In GenericService" + id + ".onServiceError: " + JSON.stringify(err));

        sharedData[id] = {value: "This is the result from failed service #" + id};
        self.emit("error", err);
    }
}

// Next line makes this object inherit from events.EventEmitter
GenericService.prototype.__proto__ = events.EventEmitter.prototype;

if(typeof module !== "undefined")
{
    module.exports = GenericService;
}
