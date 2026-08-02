package com.kollekt.acceptance

import com.kollekt.domain.Member
import com.kollekt.repository.MemberRepository
import com.kollekt.service.TokenStoreService
import org.junit.jupiter.api.BeforeEach
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.CommandLineRunner
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc

abstract class AcceptanceTestSupport {
    @Autowired lateinit var mockMvc: MockMvc

    @Autowired lateinit var memberRepository: MemberRepository

    @MockitoBean(name = "seedData")
    lateinit var seedData: CommandLineRunner

    // TokenStoreService is used by SecurityConfig; mock it to keep tests deterministic.
    @MockitoBean lateinit var tokenStoreService: TokenStoreService

    @BeforeEach
    fun setUpAcceptanceContext() {
        val collectiveCode = "TEST-COLLECTIVE"
        ensureMember("Kasper", "kasper@example.com", collectiveCode)
        ensureMember("Emma", "emma@example.com", collectiveCode)
    }

    /** Builds an authenticated-request post-processor whose `uid` claim resolves to the real
     *  seeded member — [CurrentMemberContext] always resolves identity via `uid`, never a bare
     *  name, so a hand-built test JWT needs it too. */
    protected fun jwtFor(name: String) =
        SecurityMockMvcRequestPostProcessors.jwt().jwt {
            it.subject(name).claim("uid", memberRepository.findByName(name)!!.id)
        }

    protected fun extractId(json: String): Long {
        val idRegex = "\"id\"\\s*:\\s*(\\d+)".toRegex()
        return idRegex.find(json)!!.groupValues[1].toLong()
    }

    private fun ensureMember(
        name: String,
        email: String,
        collectiveCode: String,
    ) {
        if (memberRepository.findByName(name) == null) {
            memberRepository.saveAndFlush(
                Member(name = name, email = email, level = 1, xp = 0, collectiveCode = collectiveCode),
            )
        }
    }
}
