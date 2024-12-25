function runTest(config,qualifier) {

    var testname = testnamePrefix(qualifier, config.keysystem)
                                    + ', persistent-license, '
                                    + /video\/([^;]*)/.exec(config.videoType)[1]
                                    + 'playback';

    var configuration = {   initDataTypes: [ config.initDataType ],
                            audioCapabilities: [ { contentType: config.audioType } ],
                            videoCapabilities: [ { contentType: config.videoType } ],
                            sessionTypes: [ 'persistent-license' ] };


    async_test(function(test) {
        var _video = config.video,
            _mediaKeys,
            _mediaKeySession,
            _sessionId,
            _mediaSource;

        function onFailure(error) {
            console.log("[NEU] onFailure");
            forceTestFailureFromPromise(test, error);
        }

        function onMessage(event) {
            console.log("[NEU] onMessage");
            assert_equals( event.target, _mediaKeySession );
            assert_true( event instanceof window.MediaKeyMessageEvent );
            assert_equals( event.type, 'message');

            assert_in_array( event.messageType, [ 'license-request', 'individualization-request' ] );
            console.log("[NEU] onMessage type: " + event.messageType);

            _sessionId = _mediaKeySession.sessionId;
            console.log("[NEU] onMessage _sessionId: " + _sessionId); 
            config.messagehandler(event.messageType, event.message).then( function( response ) {
                console.log("[NEU] onMessage update");
                return _mediaKeySession.update(response)
            }).then(function() {
                _mediaKeySession.load(_sessionId).then(function (success) {
                     console.log("[NEU] onMessage load result : " + success);
                });
                console.log("[NEU] onMessage messagehandler end");
            }).catch(onFailure);
        }

        function onEncrypted(event) {
            console.log("[NEU] onEncrypted");
            assert_equals(event.target, _video);
            assert_true(event instanceof window.MediaEncryptedEvent);
            assert_equals(event.type, 'encrypted');

            waitForEventAndRunStep('message', _mediaKeySession, onMessage, test);
            console.log("[NEU] generateRequest");
            _mediaKeySession.generateRequest(   config.initData ? config.initDataType : event.initDataType,
                                                config.initData || event.initData ).catch(onFailure);
        }

        function onTimeupdate(event) {
            if (_video.currentTime > (config.duration || 1)) {
                _video.pause();
                test.done();
            }
        }

        function onPlaying(event) {
            // Not using waitForEventAndRunStep() to avoid too many
            // EVENT(onTimeUpdate) logs.
            _video.addEventListener('timeupdate', onTimeupdate, true);
        }
        console.log("[NEU] requestMediaKeySystemAccess");
        navigator.requestMediaKeySystemAccess(config.keysystem, [ configuration ]).then(function(access) {
            console.log("[NEU] createMediaKeys");
            return access.createMediaKeys();
        }).then(function(mediaKeys) {
            _mediaKeys = mediaKeys;
            console.log("[NEU] setMediaKeys");
            return _video.setMediaKeys(_mediaKeys);
        }).then(function() {
            console.log("[NEU] createSession");
            _mediaKeySession = _mediaKeys.createSession( 'persistent-license' );
            waitForEventAndRunStep('encrypted', _video, onEncrypted, test);
            waitForEventAndRunStep('playing', _video, onPlaying, test);
            return testmediasource(config);
        }).then(function(source) {
            _mediaSource = source;
            console.log("[NEU] createObjectURL");
            _video.src = URL.createObjectURL(_mediaSource);
            return source.done;
        }).then(function(){
            console.log("[NEU] willplay");
            // _video.play();
        }).catch(onFailure);
    }, testname);
}
