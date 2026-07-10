package com.kollekt.config

import jakarta.servlet.ServletOutputStream
import jakarta.servlet.WriteListener
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import jakarta.servlet.http.HttpServletResponseWrapper
import org.slf4j.LoggerFactory
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import java.io.OutputStreamWriter
import java.io.PrintWriter
import java.nio.charset.Charset
import java.nio.charset.StandardCharsets
import java.util.UUID

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
class PerformanceLoggingFilter : OncePerRequestFilter() {
    private val log = LoggerFactory.getLogger(javaClass)

    override fun shouldNotFilter(request: HttpServletRequest): Boolean = !request.requestURI.startsWith("/api/")

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: jakarta.servlet.FilterChain,
    ) {
        val requestId = request.getHeader("X-Request-Id")?.take(100) ?: UUID.randomUUID().toString()
        response.setHeader("X-Request-Id", requestId)
        val countingResponse = CountingHttpServletResponse(response)
        val startedAt = System.nanoTime()
        try {
            filterChain.doFilter(request, countingResponse)
        } finally {
            log.info(
                "request_complete request_id={} method={} path={} status={} duration_ms={} response_bytes={}",
                requestId,
                request.method,
                request.requestURI,
                countingResponse.status,
                (System.nanoTime() - startedAt) / 1_000_000,
                countingResponse.bytesWritten,
            )
        }
    }
}

private class CountingHttpServletResponse(
    response: HttpServletResponse,
) : HttpServletResponseWrapper(response) {
    private val countingStream = CountingServletOutputStream(response.outputStream)
    private var responseWriter: PrintWriter? = null

    val bytesWritten: Long
        get() = countingStream.bytesWritten

    override fun getOutputStream(): ServletOutputStream = countingStream

    override fun getWriter(): PrintWriter {
        if (responseWriter == null) {
            val charset = characterEncoding?.let(Charset::forName) ?: StandardCharsets.UTF_8
            responseWriter = PrintWriter(OutputStreamWriter(countingStream, charset))
        }
        return responseWriter!!
    }
}

private class CountingServletOutputStream(
    private val delegate: ServletOutputStream,
) : ServletOutputStream() {
    var bytesWritten: Long = 0
        private set

    override fun write(value: Int) {
        delegate.write(value)
        bytesWritten++
    }

    override fun write(
        bytes: ByteArray,
        offset: Int,
        length: Int,
    ) {
        delegate.write(bytes, offset, length)
        bytesWritten += length
    }

    override fun flush() = delegate.flush()

    override fun close() = delegate.close()

    override fun isReady(): Boolean = delegate.isReady

    override fun setWriteListener(writeListener: WriteListener?) = delegate.setWriteListener(writeListener)
}
