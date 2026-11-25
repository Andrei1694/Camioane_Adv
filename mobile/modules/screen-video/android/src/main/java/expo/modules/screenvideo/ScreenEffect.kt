package expo.modules.screenvideo

import android.content.Context
import android.opengl.GLES20
import androidx.media3.common.VideoFrameProcessingException
import androidx.media3.common.util.GlProgram
import androidx.media3.common.util.GlUtil
import androidx.media3.common.util.Size
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.BaseGlShaderProgram
import androidx.media3.effect.GlEffect
import androidx.media3.effect.GlShaderProgram
import org.json.JSONObject

@UnstableApi
class ScreenEffect(json: String) : GlEffect {
  private val layout = JSONObject(json)
  init {
    require(layout.getInt("width") == 2304 && layout.getInt("height") == 512)
    require(layout.getDouble("sourceWidth") > 0 && layout.getDouble("sourceHeight") > 0)
    require(layout.getJSONArray("regions").length() == 3)
    for (i in 0..2) {
      val r = layout.getJSONArray("regions").getJSONObject(i)
      for (key in listOf("sx", "sy", "sw", "sh", "dx", "dy", "dw", "dh")) {
        val value = r.getDouble(key)
        require(value.isFinite() && value >= 0)
      }
      require(listOf("sw", "sh", "dw", "dh").all { r.getDouble(it) > 0 })
    }
  }
  override fun toGlShaderProgram(context: Context, useHdr: Boolean): GlShaderProgram = ScreenShader(layout, useHdr)
}

@UnstableApi
private class ScreenShader(layout: JSONObject, useHdr: Boolean) : BaseGlShaderProgram(useHdr, 1) {
  private val program = GlProgram(
    """
      attribute vec4 aFramePosition;
      void main() { gl_Position = aFramePosition; }
    """.trimIndent(),
    """
      precision highp float;
      uniform sampler2D uTexture;
      uniform vec2 uSourceSize;
      uniform vec4 uSrc0; uniform vec4 uDst0;
      uniform vec4 uSrc1; uniform vec4 uDst1;
      uniform vec4 uSrc2; uniform vec4 uDst2;
      vec4 region(vec2 p, vec4 src, vec4 dst) {
        vec2 q = (p - dst.xy) / dst.zw;
        vec2 uv = (src.xy + q * src.zw) / uSourceSize;
        return texture2D(uTexture, vec2(uv.x, 1.0 - uv.y));
      }
      bool inside(vec2 p, vec4 r) { return p.x >= r.x && p.y >= r.y && p.x < r.x + r.z && p.y < r.y + r.w; }
      void main() {
        vec2 p = vec2(gl_FragCoord.x, 512.0 - gl_FragCoord.y);
        if (inside(p, uDst0)) gl_FragColor = region(p, uSrc0, uDst0);
        else if (inside(p, uDst1)) gl_FragColor = region(p, uSrc1, uDst1);
        else if (inside(p, uDst2)) gl_FragColor = region(p, uSrc2, uDst2);
        else gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      }
    """.trimIndent()
  )
  init {
    program.setBufferAttribute("aFramePosition", GlUtil.getNormalizedCoordinateBounds(), 4)
    program.setFloatsUniform("uSourceSize", floatArrayOf(layout.getDouble("sourceWidth").toFloat(), layout.getDouble("sourceHeight").toFloat()))
    for (i in 0..2) {
      val r = layout.getJSONArray("regions").getJSONObject(i)
      program.setFloatsUniform("uSrc$i", floatArrayOf(r.getDouble("sx").toFloat(), r.getDouble("sy").toFloat(), r.getDouble("sw").toFloat(), r.getDouble("sh").toFloat()))
      program.setFloatsUniform("uDst$i", floatArrayOf(r.getDouble("dx").toFloat(), r.getDouble("dy").toFloat(), r.getDouble("dw").toFloat(), r.getDouble("dh").toFloat()))
    }
  }
  override fun configure(inputWidth: Int, inputHeight: Int) = Size(2304, 512)
  override fun drawFrame(inputTexId: Int, presentationTimeUs: Long) {
    try {
      program.use()
      program.setSamplerTexIdUniform("uTexture", inputTexId, 0)
      program.bindAttributesAndUniforms()
      GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
      GlUtil.checkGlError()
    } catch (error: Exception) { throw VideoFrameProcessingException.from(error, presentationTimeUs) }
  }
  override fun release() {
    super.release()
    program.delete()
  }
}
