function runTest(config,qualifier) {

    var testname = testnamePrefix(qualifier, config.keysystem)
                                    + ', temporary, '
                                    + /video\/([^;]*)/.exec(config.videoType)[1]
                                    + ', playback, ' + config.testcase;

    var configuration = {   initDataTypes: [ config.initDataType ],
                            audioCapabilities: [ { contentType: config.audioType } ],
                            videoCapabilities: [ { contentType: config.videoType } ],
                            sessionTypes: [ 'temporary' ] };

    async_test(function(test) {

        var _video = config.video,
            _mediaKeys,
            _mediaKeySession,
            _mediaSource;

        function onFailure(error) {
            forceTestFailureFromPromise(test, error);
        }

        function onEncrypted(event) {
            console.log("[NEU]onEncrypted start");
            assert_equals(event.target, _video);
            assert_true(event instanceof window.MediaEncryptedEvent);
            assert_equals(event.type, 'encrypted');

            // Only create the session for the firs encrypted event
            if (_mediaKeySession !== undefined) return;

            var initDataType = config.initData ? config.initDataType : event.initDataType;
            var initData = config.initData || event.initData;
            console.log("[NEU]onEncrypted createSession");
            _mediaKeySession = _mediaKeys.createSession('temporary');
            waitForEventAndRunStep('message', _mediaKeySession, onMessage, test);
            console.log("[NEU]onEncrypted generateRequest");
            _mediaKeySession.generateRequest( initDataType, initData ).catch(onFailure);
        }

        function onMessage(event) {
            console.log("[NEU]onMessage start");
            assert_equals(event.target, _mediaKeySession);
            assert_true(event instanceof window.MediaKeyMessageEvent);
            assert_equals(event.type, 'message');

            assert_in_array(event.messageType, ['license-request', 'individualization-request']);

            config.messagehandler(event.messageType, event.message).then(function(response) {
                console.log("[NEU]onMessage update");
                return event.target.update(response);
            }).catch(onFailure);
        }

        function onPlaying(event) {
            // Not using waitForEventAndRunStep() to avoid too many
            // EVENT(onTimeUpdate) logs.
            _video.addEventListener('timeupdate', onTimeupdate, true);
        }

        function onTimeupdate(event) {
            if ( _video.currentTime > (config.duration || 1)) {
                _video.pause();
                test.done();
            }
        }
        console.log("[NEU]requestMediaKeySystemAccess start");
        navigator.requestMediaKeySystemAccess(config.keysystem, [configuration]).then(function(access) {
            console.log("[NEU]requestMediaKeySystemAccess end");
            return access.createMediaKeys();
        }).then(function(mediaKeys) {
            _mediaKeys = mediaKeys;
            console.log("[NEU]setMediaKeys start");
            return _video.setMediaKeys(_mediaKeys);
        }).then(function(){
            waitForEventAndRunStep('encrypted', _video, onEncrypted, test);
            waitForEventAndRunStep('playing', _video, onPlaying, test);
            return testmediasource(config);
        }).then(function(source) {
            _mediaSource = source;
            _video.src = URL.createObjectURL(_mediaSource);
            return source.done;
        }).then(function(){
            console.log("[NEU]will play");
            // _video.play();
        }).catch(onFailure);
    }, testname);
}
