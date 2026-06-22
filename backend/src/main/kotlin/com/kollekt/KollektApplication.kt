package com.kollekt

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@EnableScheduling
@SpringBootApplication
class KollektApplication

fun main(args: Array<String>) {
    runApplication<KollektApplication>(*args)
}
