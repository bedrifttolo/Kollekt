xattr -cr ios/DerivedData/5002BFB8.../App.app && \
codesign --force --deep --sign - ios/DerivedData/5002BFB8.../App.app && \
xcrun simctl install 5002BFB8-BF94-471A-8B59-0A224787C3D9 ios/DerivedData/.../App.app && \
xcrun simctl launch 5002BFB8-BF94-471A-8B59-0A224787C3D9 no.kollekt.app
