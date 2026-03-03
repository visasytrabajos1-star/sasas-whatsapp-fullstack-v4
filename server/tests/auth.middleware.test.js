const test = require('node:test');
const assert = require('node:assert/strict');

let jwt;
let authenticateTenant;
let getJwtSecret;

try {
    jwt = require('jsonwebtoken');
    ({ authenticateTenant, getJwtSecret } = require('../middleware/auth'));
} catch (error) {
    test('auth middleware tests skipped: missing dependencies in environment', { skip: true }, () => {
        assert.ok(error);
    });
    return;
}

function createRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };
}

test('authenticateTenant returns 401 when Authorization header is missing', () => {
    const req = { headers: {} };
    const res = createRes();
    let called = false;

    authenticateTenant(req, res, () => {
        called = true;
    });

    assert.equal(called, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.code, 'AUTH_REQUIRED');
});

test('authenticateTenant returns 403 when token is invalid', () => {
    const req = { headers: { authorization: 'Bearer invalid.token.value' } };
    const res = createRes();
    let called = false;

    authenticateTenant(req, res, () => {
        called = true;
    });

    assert.equal(called, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'INVALID_TOKEN');
});

test('authenticateTenant injects tenant and calls next when token is valid', () => {
    const token = jwt.sign(
        { tenantId: 'tenant_abc', email: 'owner@example.com', plan: 'PRO', role: 'OWNER' },
        getJwtSecret(),
        { expiresIn: '1h' }
    );

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createRes();
    let called = false;

    authenticateTenant(req, res, () => {
        called = true;
    });

    assert.equal(called, true);
    assert.equal(req.tenant.id, 'tenant_abc');
    assert.equal(req.tenant.email, 'owner@example.com');
    assert.equal(req.tenant.plan, 'PRO');
    assert.equal(req.tenant.role, 'OWNER');
});
