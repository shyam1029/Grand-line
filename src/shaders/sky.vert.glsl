// Sky dome — vertex stage. Passes the view ray through each vertex.

varying vec3 vDirection;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vDirection = worldPosition.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
