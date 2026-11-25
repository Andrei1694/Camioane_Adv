Pod::Spec.new do |s|
  s.name = 'ScreenVideo'
  s.version = '1.0.0'
  s.summary = 'Truck-screen video preview and conversion'
  s.description = s.summary
  s.license = { :type => 'Proprietary' }
  s.author = 'Camioane'
  s.homepage = 'https://expo.dev'
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation', 'CoreImage', 'UIKit'
  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
