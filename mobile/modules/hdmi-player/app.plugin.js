const { withInfoPlist } = require('expo/config-plugins')

// The phone continues to use Expo's scene delegate. Only the noninteractive external
// scene uses ours. iOS 27+ also requires the runtime scene-accessory registration.
module.exports = function withHdmiPlayer(config) {
  return withInfoPlist(config, (config) => {
    // AVPlayer needs the media background mode to continue on a connected display
    // while the phone is locked or another app is in front.
    config.modResults.UIBackgroundModes = [...new Set([...(config.modResults.UIBackgroundModes ?? []), 'audio'])]
    const manifest = config.modResults.UIApplicationSceneManifest ?? {}
    const configurations = manifest.UISceneConfigurations ?? {}
    config.modResults.UIApplicationSceneManifest = {
      ...manifest,
      UIApplicationSupportsMultipleScenes: true,
      UISceneConfigurations: {
        ...configurations,
        UIWindowSceneSessionRoleExternalDisplayNonInteractive: [{
          UISceneConfigurationName: 'HDMI video',
          UISceneClassName: 'UIWindowScene',
          UISceneDelegateClassName: 'CamioaneHdmiSceneDelegate',
        }],
      },
    }
    return config
  })
}
