# Do not use this implementation in a secure context.

import binascii, sys
from base64 import b64encode

sys.stdout.reconfigure(encoding='utf-8')


def hextobase64(hexstring):
    return b64encode(binascii.unhexlify(hexstring))


def euclidgcd(a, b):
    while b != 0:
        (a, b) = (b, a % b)

    return a


def extendedeuclidbezout(a, b):
    old_r = a
    r = b
    old_s = 1
    s = 0
    old_t = 0
    t = 1

    while r != 0:
        quotient = old_r // r
        (old_r, r) = (r, old_r - quotient * r)
        (old_s, s) = (s, old_s - quotient * s)
        (old_t, t) = (t, old_t - quotient * t)

    return old_s, old_t


def euclidlcm(a, b):
    return int(abs(a * b) // euclidgcd(a, b))


p = 169006138109910516166492915207105157959
print('p:', hex(p))

q = 36667241895256263705295135957180769531
print('q:', hex(q))

e = 65537

n = p * q
print('n:', hex(n))
carmichael = euclidlcm(p - 1, q - 1)
print('λ(n):', hex(carmichael))
print('Computing private key exponent (d) ≡', str(e) + '^{-1} (mod', hex(carmichael) + ')')
d = extendedeuclidbezout(e, carmichael)[0] % carmichael
print('Obtained', hex(d))

plaintext = 'Attack at dawn.'
print('Plaintext, m:', '0x' + plaintext.encode('ascii').hex())

plaintext = binascii.hexlify(plaintext.encode()).decode()

c = pow(int(plaintext, 16), e, n)
print('Ciphertext, c:', hex(c))

m = pow(c, d, n)
print('Decrypted plaintext, m:', hex(m))
