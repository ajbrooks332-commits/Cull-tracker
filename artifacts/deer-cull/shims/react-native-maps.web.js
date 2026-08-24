const React = require('react');
const { View } = require('react-native');

const noop = () => null;

function MapView({ children, style }) {
  return React.createElement(View, { style }, children);
}
MapView.Animated = MapView;

module.exports = MapView;
module.exports.default = MapView;
module.exports.Marker = noop;
module.exports.Callout = noop;
module.exports.Polyline = noop;
module.exports.Polygon = noop;
module.exports.Circle = noop;
module.exports.MapCalloutSubview = noop;
module.exports.Overlay = noop;
module.exports.MAP_TYPES = {};
module.exports.PROVIDER_GOOGLE = 'google';
module.exports.PROVIDER_DEFAULT = null;
